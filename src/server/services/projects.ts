import { z } from 'zod'
import { itemTotal, sumDecimals } from '@/features/budget/calc'
import { evaluateCompleteness } from '@/features/projects/completeness'
import { PROJECT_COLUMN_FIELDS, getStep, type FieldDef } from '@/features/projects/steps'
import { DEFAULT_WORKFLOW, STATUS_LABELS, workflowSchema, type WorkflowConfig } from '@/features/workflow/config'
import {
  NotFoundError,
  PermissionError,
  ValidationError,
  allowedTransitions,
  canCreateProject,
  canEditContent,
  canViewProject,
  hasAnyRole,
  isAdmin,
  membership,
} from '@/server/auth/permissions'
import type { Store } from '@/server/db/types'
import { SETTING_KEYS } from '@/server/settings/defaults'
import {
  TABLE_SCHEMAS,
  createProjectSchema,
  idSchema,
  memberSchema,
  transitionSchema,
  zodMessages,
  type CreateProjectInput,
  type TableEntity,
} from '@/server/validation/schemas'
import type { ProjectBundle } from '@/types/bundle'
import type { FieldMeta, Project, ProjectMember, ProjectSection, ProjectStatus } from '@/types/domain'
import { audit, getSetting, newId, nowIso, type Ctx } from './common'

// ---------------------------------------------------------------- leitura

export async function getWorkflow(store: Store): Promise<WorkflowConfig> {
  return getSetting(store, SETTING_KEYS.workflow, workflowSchema, DEFAULT_WORKFLOW)
}

export async function loadBundle(store: Store, project: Project): Promise<ProjectBundle> {
  const pid = project.id
  const w = { where: { project_id: pid } }
  const [members, sections, objectives, indicators, budget, schedule, risks, documents, reviews, approvals, versions, deliverables, expenses, accountability, allocations, unit, owner] =
    await Promise.all([
      store.list('project_members', w),
      store.list('project_sections', w),
      store.list('project_objectives', { ...w, orderBy: { column: 'position' } }),
      store.list('project_indicators', { ...w, orderBy: { column: 'position' } }),
      store.list('project_budget_items', { ...w, orderBy: { column: 'position' } }),
      store.list('project_schedule', { ...w, orderBy: { column: 'position' } }),
      store.list('project_risks', { ...w, orderBy: { column: 'position' } }),
      store.list('project_documents', { ...w, orderBy: { column: 'created_at' } }),
      store.list('project_reviews', { ...w, orderBy: { column: 'created_at' } }),
      store.list('project_approvals', { ...w, orderBy: { column: 'created_at' } }),
      store.list('project_versions', { ...w, orderBy: { column: 'version_number', ascending: false } }),
      store.list('project_deliverables', { ...w, orderBy: { column: 'planned_date' } }),
      store.list('project_expenses', { ...w, orderBy: { column: 'issue_date' } }),
      store.list('accountability_records', w),
      store.list('project_funding_allocations', w),
      store.get('organizational_units', project.unit_id),
      store.get('profiles', project.owner_id),
    ])
  const memberProfiles = members.length
    ? await store.list('profiles', { where: { id: members.map((m) => m.user_id) } })
    : []
  return {
    project,
    unit,
    owner,
    members,
    memberProfiles,
    sections: Object.fromEntries(sections.map((s) => [s.section_key, s])),
    objectives,
    indicators,
    budget,
    schedule,
    risks,
    documents,
    reviews,
    approvals,
    versions,
    deliverables,
    expenses,
    accountability,
    allocations,
  }
}

/**
 * Carrega o projeto verificando a permissão de visualização.
 * Retorna "não encontrado" também quando não há permissão, para não revelar a existência do registro.
 */
export async function getProjectForUser(ctx: Ctx, projectId: string): Promise<{ project: Project; members: ProjectMember[] }> {
  if (!idSchema.safeParse(projectId).success) throw new NotFoundError('Projeto não encontrado.')
  const project = await ctx.store.get('projects', projectId)
  if (!project || project.deleted_at) throw new NotFoundError('Projeto não encontrado.')
  const members = await ctx.store.list('project_members', { where: { project_id: projectId } })
  if (!canViewProject(ctx.user, project, members)) {
    await audit(ctx, 'acesso_negado', 'projects', projectId, projectId, { motivo: 'visualizacao' })
    throw new NotFoundError('Projeto não encontrado.')
  }
  return { project, members }
}

export async function getBundleForUser(ctx: Ctx, projectId: string): Promise<ProjectBundle> {
  const { project } = await getProjectForUser(ctx, projectId)
  return loadBundle(ctx.store, project)
}

export async function listVisibleProjects(ctx: Ctx): Promise<Project[]> {
  const [projects, members] = await Promise.all([
    ctx.store.list('projects', { orderBy: { column: 'updated_at', ascending: false } }),
    ctx.store.list('project_members', { where: { user_id: ctx.user.id } }),
  ])
  return projects.filter((p) => canViewProject(ctx.user, p, members))
}

async function requireEditable(ctx: Ctx, projectId: string) {
  const { project, members } = await getProjectForUser(ctx, projectId)
  if (!canEditContent(ctx.user, project, members)) {
    await audit(ctx, 'acesso_negado', 'projects', projectId, projectId, { motivo: 'edicao', status: project.status })
    throw new PermissionError(
      project.status && !['rascunho', 'em_elaboracao', 'correcao_solicitada'].includes(project.status)
        ? `O projeto está "${STATUS_LABELS[project.status]}" e não pode ser editado.`
        : 'Somente o responsável e colaboradores podem editar este projeto.',
    )
  }
  return { project, members }
}

// ---------------------------------------------------------------- criação

async function nextCode(store: Store): Promise<string> {
  const year = new Date().getFullYear()
  const all = await store.list('projects', { includeDeleted: true })
  const prefix = `FUNPES-${year}-`
  const max = all
    .map((p) => (p.code.startsWith(prefix) ? Number(p.code.slice(prefix.length)) : 0))
    .reduce((a, b) => Math.max(a, Number.isFinite(b) ? b : 0), 0)
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export async function createProject(ctx: Ctx, input: CreateProjectInput): Promise<Project> {
  if (!canCreateProject(ctx.user)) throw new PermissionError('Seu perfil não permite criar projetos.')
  const parsed = createProjectSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Dados inválidos.', zodMessages(parsed.error))
  const data = parsed.data
  const unit = await ctx.store.get('organizational_units', data.unit_id)
  if (!unit || !unit.active || unit.deleted_at) throw new ValidationError('Unidade inválida.')
  // Proponentes só criam projetos para unidades em que possuem papel (ou papel global).
  if (!hasAnyRole(ctx.user, ['proponente', 'gestor_unidade'], unit.id)) {
    throw new PermissionError('Você só pode criar projetos para a sua unidade.')
  }
  const now = nowIso()
  const project: Project = {
    id: newId(),
    // No Supabase o código sequencial é gerado por gatilho no banco (RLS impede ver todos os projetos).
    code: ctx.store.kind === 'supabase' ? '' : await nextCode(ctx.store),
    title: data.title,
    unit_id: unit.id,
    owner_id: ctx.user.id,
    thematic_area: data.thematic_area ?? null,
    project_type: data.project_type,
    location: null,
    beneficiaries: null,
    status: 'rascunho',
    current_step: 1,
    completion: 0,
    requested_amount: '0.00',
    approved_amount: null,
    version: 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  const created = await ctx.store.insert('projects', project)
  await ctx.store.insert('project_members', {
    id: newId(),
    project_id: project.id,
    user_id: ctx.user.id,
    member_role: 'responsavel',
    created_at: now,
  })
  await audit(ctx, 'criar', 'projects', created.id, created.id, { code: created.code })
  return created
}

// ---------------------------------------------------------------- etapas

function fieldSchema(f: FieldDef) {
  let s = z.string().max(f.maxLength, `${f.label}: máximo de ${f.maxLength} caracteres`)
  if (f.options) {
    const values = f.options.map((o) => o.value)
    s = s.refine((v) => v === '' || values.includes(v), `${f.label}: opção inválida`) as unknown as typeof s
  }
  return s
}

async function refreshDerived(ctx: Ctx, projectId: string, patch: Partial<Project> = {}): Promise<Project> {
  const project = await ctx.store.get('projects', projectId)
  if (!project) throw new NotFoundError()
  const bundle = await loadBundle(ctx.store, { ...project, ...patch })
  bundle.project.requested_amount = sumDecimals(bundle.budget.map((b) => b.total))
  const completion = evaluateCompleteness(bundle).percent
  return ctx.store.update('projects', projectId, {
    ...patch,
    requested_amount: bundle.project.requested_amount,
    completion,
    updated_at: nowIso(),
  })
}

/** Ao editar um rascunho, o projeto passa automaticamente a "em elaboração". */
async function autoStart(ctx: Ctx, project: Project): Promise<Partial<Project>> {
  if (project.status !== 'rascunho') return {}
  await ctx.store.insert('project_approvals', {
    id: newId(),
    project_id: project.id,
    from_status: 'rascunho',
    to_status: 'em_elaboracao',
    actor_id: ctx.user.id,
    note: 'Início automático da elaboração.',
    administrative_reference: null,
    created_at: nowIso(),
  })
  return { status: 'em_elaboracao' }
}

export interface SaveStepInput {
  values: Record<string, string>
  /** Campos cujo texto veio de sugestão da IA aceita pelo servidor. */
  aiAcceptedFields?: string[]
  nextStep?: number
}

export async function saveStep(ctx: Ctx, projectId: string, stepNumber: number, input: SaveStepInput): Promise<Project> {
  const step = getStep(stepNumber)
  if (!step) throw new ValidationError('Etapa inválida.')
  const { project } = await requireEditable(ctx, projectId)

  const shape = Object.fromEntries(step.fields.map((f) => [f.key, fieldSchema(f).optional()]))
  const parsed = z.object(shape).strict().safeParse(input.values)
  if (!parsed.success) throw new ValidationError('Há campos inválidos nesta etapa.', zodMessages(parsed.error))
  const values = Object.fromEntries(
    Object.entries(parsed.data as Record<string, string | undefined>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, (v as string).replace(/\r\n/g, '\n').trim()]),
  )
  const aiFields = new Set((input.aiAcceptedFields ?? []).filter((k) => k in values))

  const projectPatch: Partial<Project> = {}
  const sectionValues: Record<string, string> = {}
  for (const [k, v] of Object.entries(values)) {
    if (step.kind === 'identification' && (PROJECT_COLUMN_FIELDS as readonly string[]).includes(k)) {
      if (k === 'title' && !v) throw new ValidationError('O título do projeto é obrigatório.')
      ;(projectPatch as Record<string, unknown>)[k] = v || null
    } else {
      sectionValues[k] = v
    }
  }

  if (Object.keys(sectionValues).length || step.fields.length === 0) {
    await upsertSection(ctx, projectId, step.section, sectionValues, aiFields)
  }
  if (projectPatch.title === null) delete projectPatch.title

  const nextStep = input.nextStep && getStep(input.nextStep) ? input.nextStep : project.current_step
  const updated = await refreshDerived(ctx, projectId, {
    ...projectPatch,
    ...(await autoStart(ctx, project)),
    current_step: nextStep,
  })
  await audit(ctx, 'salvar_etapa', 'projects', projectId, projectId, { etapa: stepNumber, campos: Object.keys(values), ia: [...aiFields] })
  return updated
}

async function upsertSection(ctx: Ctx, projectId: string, key: string, values: Record<string, string>, aiFields: Set<string>) {
  const now = nowIso()
  const [existing] = await ctx.store.list('project_sections', { where: { project_id: projectId, section_key: key } })
  const prevContent = existing?.content ?? {}
  const meta: Record<string, FieldMeta> = { ...(existing?.field_meta ?? {}) }
  for (const [k, v] of Object.entries(values)) {
    if (prevContent[k] === v && !aiFields.has(k)) continue
    if (!v) {
      delete meta[k]
      continue
    }
    meta[k] = { origin: aiFields.has(k) ? 'ia_aceita' : 'servidor', updated_at: now, updated_by: ctx.user.id }
  }
  const content = { ...prevContent, ...values }
  if (existing) {
    await ctx.store.update('project_sections', existing.id, { content, field_meta: meta, updated_by: ctx.user.id, updated_at: now })
  } else {
    const row: ProjectSection = { id: newId(), project_id: projectId, section_key: key, content, field_meta: meta, updated_by: ctx.user.id, updated_at: now }
    await ctx.store.insert('project_sections', row)
  }
}

// ---------------------------------------------------------------- tabelas

const TABLE_MAP = {
  objectives: 'project_objectives',
  indicators: 'project_indicators',
  budget: 'project_budget_items',
  schedule: 'project_schedule',
  risks: 'project_risks',
} as const

export const MAX_ROWS = 300

/**
 * Substitui o conjunto de linhas de uma tabela do projeto (objetivos,
 * indicadores, orçamento, cronograma, riscos). Totais do orçamento são
 * SEMPRE recalculados no servidor.
 */
export async function saveTableRows(ctx: Ctx, projectId: string, entity: TableEntity, rows: unknown[]): Promise<Project> {
  if (!(entity in TABLE_SCHEMAS)) throw new ValidationError('Tabela inválida.')
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new ValidationError(`Máximo de ${MAX_ROWS} linhas.`)
  const { project } = await requireEditable(ctx, projectId)
  const schema = TABLE_SCHEMAS[entity]
  const errors: string[] = []
  const parsedRows = rows.map((r, i) => {
    const res = schema.safeParse(r)
    if (!res.success) errors.push(...zodMessages(res.error).map((m) => `Linha ${i + 1} — ${m}`))
    return res.success ? (res.data as Record<string, unknown>) : null
  })
  if (errors.length) throw new ValidationError('Há linhas inválidas.', errors)

  const table = TABLE_MAP[entity]
  const existing = (await ctx.store.list(table, { where: { project_id: projectId } })) as unknown as { id: string }[]
  const existingIds = new Set(existing.map((e) => e.id))
  const keep = new Set<string>()
  const documentIds = new Set((await ctx.store.list('project_documents', { where: { project_id: projectId } })).map((d) => d.id))

  // IDs temporários do cliente são remapeados para IDs do servidor (dependências do cronograma).
  const idMap = new Map<string, string>()
  const finalIds = (parsedRows as Record<string, unknown>[]).map((row) => {
    const clientId = row.id as string | null | undefined
    const finalId = clientId && existingIds.has(clientId) ? clientId : newId()
    if (clientId) idMap.set(clientId, finalId)
    return finalId
  })

  for (const [position, row] of (parsedRows as Record<string, unknown>[]).entries()) {
    const id = finalIds[position]
    const record: Record<string, unknown> = { ...row, id, project_id: projectId, position }
    if (entity === 'budget') {
      record.total = itemTotal(record.quantity as string, record.unit_price as string)
      if (record.document_id && !documentIds.has(record.document_id as string)) record.document_id = null
    }
    if (entity === 'indicators' && !('current_value' in record)) {
      const prev = existing.find((e) => e.id === id) as { current_value?: string | null } | undefined
      record.current_value = prev?.current_value ?? null
    }
    if (entity === 'schedule') {
      const dep = record.depends_on as string | null
      record.depends_on = dep ? (idMap.get(dep) ?? null) : null
      if (record.depends_on === id) record.depends_on = null
    }
    keep.add(id)
    if (existingIds.has(id)) await ctx.store.update(table, id, record as never)
    else await ctx.store.insert(table, record as never)
  }
  for (const e of existing) if (!keep.has(e.id)) await ctx.store.remove(table, e.id)

  const updated = await refreshDerived(ctx, projectId, await autoStart(ctx, project))
  await audit(ctx, 'salvar_tabela', table, null, projectId, { linhas: parsedRows.length })
  return updated
}

// ---------------------------------------------------------------- versões

export async function createVersion(ctx: Ctx, projectId: string, reason: string): Promise<number> {
  const { project } = await getProjectForUser(ctx, projectId)
  if (!membership(ctx.user, project, await ctx.store.list('project_members', { where: { project_id: projectId } })) && !isAdmin(ctx.user)) {
    throw new PermissionError()
  }
  return snapshot(ctx, project, reason)
}

async function snapshot(ctx: Ctx, project: Project, reason: string): Promise<number> {
  const bundle = await loadBundle(ctx.store, project)
  const versions = await ctx.store.list('project_versions', { where: { project_id: project.id } })
  const number = versions.reduce((m, v) => Math.max(m, v.version_number), 0) + 1
  const { versions: _v, ...snapshotData } = bundle
  await ctx.store.insert('project_versions', {
    id: newId(),
    project_id: project.id,
    version_number: number,
    snapshot: snapshotData,
    reason: reason.slice(0, 300),
    created_by: ctx.user.id,
    created_at: nowIso(),
  })
  await ctx.store.update('projects', project.id, { version: number })
  await audit(ctx, 'criar_versao', 'project_versions', null, project.id, { versao: number, motivo: reason })
  return number
}

// ---------------------------------------------------------------- tramitação

export async function transitionProject(
  ctx: Ctx,
  projectId: string,
  input: { to: ProjectStatus; note?: string | null; administrative_reference?: string | null },
): Promise<Project> {
  const parsed = transitionSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Dados inválidos.', zodMessages(parsed.error))
  const { to, note, administrative_reference } = parsed.data
  const { project, members } = await getProjectForUser(ctx, projectId)
  const workflow = await getWorkflow(ctx.store)
  const transition = allowedTransitions(workflow, ctx.user, project, members).find((t) => t.to === to)
  if (!transition) {
    await audit(ctx, 'transicao_negada', 'projects', projectId, projectId, { de: project.status, para: to })
    throw new PermissionError(
      `Transição não autorizada: de "${STATUS_LABELS[project.status]}" para "${STATUS_LABELS[to]}" não é permitida para o seu perfil.`,
    )
  }
  if (transition.requireNote && !note) throw new ValidationError('Esta ação exige uma observação/justificativa.')
  if (transition.requireAdministrativeReference && !administrative_reference) {
    throw new ValidationError(
      'Esta ação exige a referência do ato ou processo administrativo correspondente (ex.: número do processo SEI). O sistema não registra decisões sem evidência administrativa.',
    )
  }
  if (transition.requireComplete) {
    const bundle = await loadBundle(ctx.store, project)
    const pend = evaluateCompleteness(bundle).pendings
    if (pend.length) {
      throw new ValidationError(
        'O projeto possui pendências obrigatórias e não pode ser encaminhado.',
        pend.slice(0, 20).map((p) => `Etapa ${p.step}: ${p.message}`),
      )
    }
  }
  const patch: Partial<Project> = { status: to, updated_at: nowIso() }
  if (to === 'aprovado') patch.approved_amount = project.requested_amount
  // O registro da tramitação precede a mudança de estado (o banco exige isso por gatilho).
  await ctx.store.insert('project_approvals', {
    id: newId(),
    project_id: projectId,
    from_status: project.status,
    to_status: to,
    actor_id: ctx.user.id,
    note: note ?? null,
    administrative_reference: administrative_reference ?? null,
    created_at: nowIso(),
  })
  const updated = await ctx.store.update('projects', projectId, patch)
  await audit(ctx, 'transicao', 'projects', projectId, projectId, { de: project.status, para: to })
  if (to === 'encaminhado' || to === 'aprovado') {
    await snapshot(ctx, updated, `Versão gerada automaticamente: ${STATUS_LABELS[to]}`)
  }
  return updated
}

// ---------------------------------------------------------------- membros e exclusão

export async function addMember(ctx: Ctx, projectId: string, input: z.input<typeof memberSchema>): Promise<void> {
  const parsed = memberSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Dados inválidos.', zodMessages(parsed.error))
  const { project, members } = await getProjectForUser(ctx, projectId)
  if (membership(ctx.user, project, members) !== 'responsavel') throw new PermissionError('Somente o responsável pode gerenciar a equipe.')
  const [profile] = await ctx.store.list('profiles', { where: { email: parsed.data.email } })
  if (!profile || !profile.active) throw new ValidationError('Usuário não encontrado ou inativo.')
  if (members.some((m) => m.user_id === profile.id)) throw new ValidationError('Usuário já participa do projeto.')
  await ctx.store.insert('project_members', {
    id: newId(),
    project_id: projectId,
    user_id: profile.id,
    member_role: parsed.data.member_role,
    created_at: nowIso(),
  })
  await audit(ctx, 'adicionar_membro', 'project_members', profile.id, projectId, { papel: parsed.data.member_role })
}

export async function removeMember(ctx: Ctx, projectId: string, memberId: string): Promise<void> {
  const { project, members } = await getProjectForUser(ctx, projectId)
  if (membership(ctx.user, project, members) !== 'responsavel') throw new PermissionError()
  const m = members.find((mm) => mm.id === memberId)
  if (!m || m.member_role === 'responsavel') throw new ValidationError('Membro inválido.')
  await ctx.store.remove('project_members', memberId)
  await audit(ctx, 'remover_membro', 'project_members', m.user_id, projectId)
}

export async function deleteProject(ctx: Ctx, projectId: string): Promise<void> {
  const { project, members } = await getProjectForUser(ctx, projectId)
  const owner = membership(ctx.user, project, members) === 'responsavel'
  if (!(owner && ['rascunho', 'em_elaboracao'].includes(project.status)) && !isAdmin(ctx.user)) {
    throw new PermissionError('Somente o responsável pode excluir projetos ainda não encaminhados.')
  }
  await ctx.store.softDelete('projects', projectId)
  await audit(ctx, 'excluir', 'projects', projectId, projectId)
}
