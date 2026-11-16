import { z } from 'zod'
import { workflowSchema } from '@/features/workflow/config'
import { PermissionError, ValidationError, canManageSettings, canManageUsers, isAdmin } from '@/server/auth/permissions'
import {
  SETTING_KEYS,
  documentTemplateSchema,
  institutionSchema,
  retentionSchema,
  DEFAULT_RETENTION,
} from '@/server/settings/defaults'
import { unitSchema, userAdminSchema, zodMessages } from '@/server/validation/schemas'
import type { Profile, UserRole } from '@/types/domain'
import { audit, getSetting, newId, nowIso, type Ctx } from './common'

// ------------------------------------------------------------ usuários

export async function listUsers(ctx: Ctx): Promise<(Profile & { roles: UserRole[] })[]> {
  if (!canManageUsers(ctx.user)) throw new PermissionError()
  const [profiles, roles] = await Promise.all([
    ctx.store.list('profiles', { orderBy: { column: 'full_name' } }),
    ctx.store.list('user_roles'),
  ])
  return profiles.map((p) => ({ ...p, roles: roles.filter((r) => r.user_id === p.id) }))
}

/**
 * Cria/edita perfil e papéis. No modo Supabase, a conta de autenticação é
 * criada por convite no painel do Supabase (ou pelo cadastro); aqui o
 * administrador vincula perfil, unidade e papéis.
 */
export async function saveUser(ctx: Ctx, input: z.input<typeof userAdminSchema>): Promise<string> {
  if (!canManageUsers(ctx.user)) throw new PermissionError()
  const parsed = userAdminSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Dados do usuário inválidos.', zodMessages(parsed.error))
  const { id, roles, ...data } = parsed.data
  if (id === ctx.user.id && (!data.active || !roles.some((r) => r.role === 'administrador'))) {
    throw new ValidationError('Você não pode remover o próprio acesso de administrador nem se desativar.')
  }
  const sameEmail = (await ctx.store.list('profiles', { where: { email: data.email } })).find((p) => p.id !== id)
  if (sameEmail) throw new ValidationError('Já existe usuário com este e-mail.')
  let userId = id ?? null
  if (userId) {
    const existing = await ctx.store.get('profiles', userId)
    if (!existing) throw new ValidationError('Usuário não encontrado.')
    await ctx.store.update('profiles', userId, data)
  } else {
    if (ctx.store.kind === 'supabase') {
      throw new ValidationError('No ambiente Supabase, convide o usuário pelo painel de autenticação; o perfil é criado automaticamente no primeiro acesso.')
    }
    userId = newId()
    await ctx.store.insert('profiles', { id: userId, ...data, created_at: nowIso() })
  }
  const current = await ctx.store.list('user_roles', { where: { user_id: userId } })
  for (const r of current) await ctx.store.remove('user_roles', r.id)
  for (const r of roles) await ctx.store.insert('user_roles', { id: newId(), user_id: userId, role: r.role, unit_id: r.unit_id, created_at: nowIso() })
  await audit(ctx, id ? 'editar_usuario' : 'criar_usuario', 'profiles', userId, null, {
    papeis: roles.map((r) => `${r.role}@${r.unit_id ?? 'global'}`),
    ativo: data.active,
  })
  return userId
}

// ------------------------------------------------------------ unidades

export async function saveUnit(ctx: Ctx, input: z.input<typeof unitSchema>) {
  if (!isAdmin(ctx.user)) throw new PermissionError()
  const parsed = unitSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Dados da unidade inválidos.', zodMessages(parsed.error))
  const { id, ...data } = parsed.data
  if (id) await ctx.store.update('organizational_units', id, data)
  else await ctx.store.insert('organizational_units', { id: newId(), ...data, created_at: nowIso(), deleted_at: null })
  await audit(ctx, id ? 'editar_unidade' : 'criar_unidade', 'organizational_units', id ?? null, null, { sigla: data.acronym })
}

// ------------------------------------------------------------ configurações

const SETTING_SCHEMAS: Record<string, z.ZodType> = {
  [SETTING_KEYS.institution]: institutionSchema,
  [SETTING_KEYS.workflow]: workflowSchema,
  [SETTING_KEYS.documentTemplate]: documentTemplateSchema,
  [SETTING_KEYS.retention]: retentionSchema,
}

export async function updateSetting(ctx: Ctx, key: string, value: unknown) {
  if (!canManageSettings(ctx.user)) throw new PermissionError()
  const schema = SETTING_SCHEMAS[key]
  if (!schema) throw new ValidationError('Configuração desconhecida.')
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new ValidationError('Configuração inválida.', zodMessages(parsed.error))
  if (key === SETTING_KEYS.workflow) {
    // Garante que decisões finais continuem exigindo referência administrativa.
    const wf = parsed.data as z.infer<typeof workflowSchema>
    const unsafe = wf.transitions.filter((t) => ['aprovado', 'rejeitado', 'encerrado'].includes(t.to) && !t.requireAdministrativeReference)
    if (unsafe.length) throw new ValidationError('Transições para Aprovado, Rejeitado e Encerrado devem exigir referência administrativa.')
    const selfApproval = wf.transitions.filter((t) => ['aprovado', 'validado_tecnicamente'].includes(t.to) && t.actors.some((a) => a === 'responsavel' || a === 'colaborador'))
    if (selfApproval.length) throw new ValidationError('Responsáveis e colaboradores não podem validar ou aprovar o próprio projeto.')
  }
  const existing = await ctx.store.get('system_settings', key)
  if (existing) await ctx.store.update('system_settings', key, { value: parsed.data, updated_at: nowIso(), updated_by: ctx.user.id })
  else await ctx.store.insert('system_settings', { id: key, value: parsed.data, updated_at: nowIso(), updated_by: ctx.user.id })
  await audit(ctx, 'alterar_configuracao', 'system_settings', key, null)
}

/** Aplica a política de retenção configurada às interações de IA e aos logs de auditoria. */
export async function applyRetention(ctx: Ctx, now = new Date()): Promise<{ ai: number; audit: number }> {
  if (!canManageSettings(ctx.user)) throw new PermissionError()
  const policy = await getSetting(ctx.store, SETTING_KEYS.retention, retentionSchema, DEFAULT_RETENTION)
  const aiLimit = new Date(now.getTime() - policy.ai_interactions_days * 86_400_000).toISOString()
  const auditLimit = new Date(now.getTime() - policy.audit_logs_days * 86_400_000).toISOString()
  const oldAi = (await ctx.store.list('ai_interactions')).filter((i) => i.created_at < aiLimit)
  const oldAudit = (await ctx.store.list('audit_logs')).filter((l) => l.created_at < auditLimit)
  for (const i of oldAi) await ctx.store.remove('ai_interactions', i.id)
  for (const l of oldAudit) await ctx.store.remove('audit_logs', l.id)
  await audit(ctx, 'aplicar_retencao', 'system_settings', SETTING_KEYS.retention, null, { ia: oldAi.length, auditoria: oldAudit.length })
  return { ai: oldAi.length, audit: oldAudit.length }
}

export async function listAuditLogs(ctx: Ctx, limit = 200) {
  if (!isAdmin(ctx.user)) throw new PermissionError()
  return ctx.store.list('audit_logs', { orderBy: { column: 'created_at', ascending: false }, limit })
}
