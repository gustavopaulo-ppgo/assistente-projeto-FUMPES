import { z } from 'zod'
import { runAssistant } from '@/ai'
import type { AiProvider, AssistantResult } from '@/ai/types'
import { NotFoundError, PermissionError, ValidationError, canEditContent } from '@/server/auth/permissions'
import { getStep } from '@/features/projects/steps'
import { idSchema } from '@/server/validation/schemas'
import type { AiInteraction } from '@/types/domain'
import { audit, newId, nowIso, type Ctx } from './common'
import { getProjectForUser, loadBundle } from './projects'

const askSchema = z.object({
  step: z.number().int().min(1).max(10),
  message: z.string().max(4000, 'Mensagem muito longa (máximo de 4.000 caracteres).'),
})

export interface AskOptions {
  provider: AiProvider
  notice?: string | null
  timeoutMs: number
  maxPerHour: number
}

/**
 * Consulta o assistente para uma etapa. Somente quem pode editar o projeto
 * usa o assistente; cada interação é registrada (auditoria e rastreabilidade).
 */
export async function askAssistant(ctx: Ctx, projectId: string, input: { step: number; message: string }, opts: AskOptions): Promise<AssistantResult> {
  const parsed = askSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
  const { project, members } = await getProjectForUser(ctx, projectId)
  if (!canEditContent(ctx.user, project, members)) throw new PermissionError('O assistente está disponível apenas para quem elabora o projeto, enquanto ele estiver em elaboração.')

  const since = new Date(Date.now() - 3_600_000).toISOString()
  const recent = (await ctx.store.list('ai_interactions', { where: { user_id: ctx.user.id } })).filter((i) => i.created_at >= since)
  if (recent.length >= opts.maxPerHour) throw new ValidationError('Limite de consultas ao assistente por hora atingido. Tente novamente mais tarde.')

  const bundle = await loadBundle(ctx.store, project)
  const outcome = await runAssistant(opts.provider, bundle, parsed.data.step, parsed.data.message, opts.timeoutMs)

  const interaction: AiInteraction = {
    id: newId(),
    project_id: projectId,
    user_id: ctx.user.id,
    step: parsed.data.step,
    // guarda a mensagem do usuário (limitada) para rastreabilidade; nunca o contexto completo
    user_message: parsed.data.message.slice(0, 2000),
    provider: opts.provider.name,
    model: opts.provider.model,
    response: outcome.error ? { erro: outcome.error } : { ...outcome.response, sugestoes: outcome.suggestions },
    status: outcome.error ? 'erro' : 'sugerida',
    accepted_fields: [],
    created_at: nowIso(),
  }
  await ctx.store.insert('ai_interactions', interaction)
  await audit(ctx, 'consulta_ia', 'ai_interactions', interaction.id, projectId, {
    etapa: parsed.data.step,
    provedor: opts.provider.name,
    status: interaction.status,
  })

  if (outcome.error) {
    return {
      ok: false,
      interactionId: interaction.id,
      mensagem: `O assistente está indisponível no momento (${outcome.error}). Você pode continuar o preenchimento manualmente — nenhum dado foi perdido.`,
      perguntas: [],
      sugestoes: [],
      pendencias: [],
      alertas: opts.notice ? [opts.notice] : [],
      provider: opts.provider.name,
    }
  }
  return {
    ok: true,
    interactionId: interaction.id,
    mensagem: outcome.response.mensagem,
    perguntas: outcome.response.perguntas,
    sugestoes: outcome.suggestions,
    pendencias: outcome.response.pendencias,
    alertas: [...(opts.notice ? [opts.notice] : []), ...outcome.response.alertas],
    provider: opts.provider.name,
  }
}

/** Registra quais sugestões o servidor aceitou (inserção no campo) ou descartou. */
export async function recordSuggestionDecision(ctx: Ctx, interactionId: string, field: string, accepted: boolean): Promise<void> {
  if (!idSchema.safeParse(interactionId).success) throw new NotFoundError()
  const interaction = await ctx.store.get('ai_interactions', interactionId)
  if (!interaction || interaction.user_id !== ctx.user.id) throw new NotFoundError()
  const step = getStep(interaction.step)
  if (!step?.fields.some((f) => f.key === field)) throw new ValidationError('Campo inválido.')
  const acceptedFields = accepted ? [...new Set([...interaction.accepted_fields, field])] : interaction.accepted_fields
  const total = ((interaction.response as { sugestoes?: unknown[] })?.sugestoes ?? []).length
  const status = acceptedFields.length === 0 ? 'descartada' : acceptedFields.length >= total ? 'aceita' : 'parcial'
  await ctx.store.update('ai_interactions', interactionId, { accepted_fields: acceptedFields, status })
}

/** Histórico de interações de IA do projeto — visível somente a quem pode ver o projeto. */
export async function listInteractions(ctx: Ctx, projectId: string, step?: number): Promise<AiInteraction[]> {
  await getProjectForUser(ctx, projectId)
  const rows = await ctx.store.list('ai_interactions', {
    where: { project_id: projectId, ...(step ? { step } : {}) },
    orderBy: { column: 'created_at', ascending: false },
    limit: 50,
  })
  return rows
}
