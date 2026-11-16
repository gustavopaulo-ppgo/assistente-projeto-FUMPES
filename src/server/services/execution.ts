import { z } from 'zod'
import { ACCOUNTABILITY_CHECKLIST } from '@/features/projects/steps'
import {
  NotFoundError,
  PermissionError,
  ValidationError,
  canManageExecution,
  canReviewAccountability,
} from '@/server/auth/permissions'
import { deliverableSchema, documentStatusSchema, expenseSchema, idSchema, optionalText, zodMessages } from '@/server/validation/schemas'
import { audit, newId, nowIso, type Ctx } from './common'
import { getProjectForUser } from './projects'

async function requireExecution(ctx: Ctx, projectId: string) {
  const access = await getProjectForUser(ctx, projectId)
  if (!canManageExecution(ctx.user, access.project, access.members)) {
    await audit(ctx, 'acesso_negado', 'projects', projectId, projectId, { motivo: 'execucao' })
    throw new PermissionError('Lançamentos de execução só são permitidos ao responsável, colaboradores ou gestor financeiro, com o projeto em execução ou prestação de contas.')
  }
  return access
}

async function assertDocumentOfProject(ctx: Ctx, projectId: string, documentId: string | null) {
  if (!documentId) return
  const doc = await ctx.store.get('project_documents', documentId)
  if (!doc || doc.deleted_at || doc.project_id !== projectId) throw new ValidationError('Documento vinculado inválido.')
}

// ------------------------------------------------------------ entregas / metas

export async function saveDeliverable(ctx: Ctx, projectId: string, input: z.input<typeof deliverableSchema>) {
  await requireExecution(ctx, projectId)
  const parsed = deliverableSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Dados da entrega inválidos.', zodMessages(parsed.error))
  const { id, ...data } = parsed.data
  await assertDocumentOfProject(ctx, projectId, data.document_id)
  if (data.status === 'entregue' && !data.delivered_date) throw new ValidationError('Informe a data de entrega.')
  if (id) {
    const existing = await ctx.store.get('project_deliverables', id)
    if (!existing || existing.project_id !== projectId) throw new NotFoundError()
    await ctx.store.update('project_deliverables', id, data)
  } else {
    await ctx.store.insert('project_deliverables', { id: newId(), project_id: projectId, ...data, created_at: nowIso() })
  }
  await audit(ctx, 'salvar_entrega', 'project_deliverables', id ?? null, projectId, { meta: data.goal, status: data.status })
}

export async function deleteDeliverable(ctx: Ctx, projectId: string, id: string) {
  await requireExecution(ctx, projectId)
  const existing = await ctx.store.get('project_deliverables', id)
  if (!existing || existing.project_id !== projectId) throw new NotFoundError()
  await ctx.store.remove('project_deliverables', id)
  await audit(ctx, 'excluir_entrega', 'project_deliverables', id, projectId)
}

// ------------------------------------------------------------ despesas

export async function saveExpense(ctx: Ctx, projectId: string, input: z.input<typeof expenseSchema>) {
  await requireExecution(ctx, projectId)
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Dados da despesa inválidos.', zodMessages(parsed.error))
  const { id, ...data } = parsed.data
  await assertDocumentOfProject(ctx, projectId, data.document_id)
  if (data.budget_item_id) {
    const item = await ctx.store.get('project_budget_items', data.budget_item_id)
    if (!item || item.project_id !== projectId) throw new ValidationError('Item de orçamento inválido.')
  }
  if (id) {
    const existing = await ctx.store.get('project_expenses', id)
    if (!existing || existing.project_id !== projectId || existing.deleted_at) throw new NotFoundError()
    if (existing.status === 'conferida') throw new ValidationError('Despesa já conferida não pode ser alterada.')
    await ctx.store.update('project_expenses', id, { ...data, status: 'lancada' })
  } else {
    await ctx.store.insert('project_expenses', {
      id: newId(),
      project_id: projectId,
      ...data,
      status: 'lancada',
      created_by: ctx.user.id,
      created_at: nowIso(),
      deleted_at: null,
    })
  }
  await audit(ctx, 'salvar_despesa', 'project_expenses', id ?? null, projectId, { valor: data.amount })
}

export async function deleteExpense(ctx: Ctx, projectId: string, id: string) {
  await requireExecution(ctx, projectId)
  const existing = await ctx.store.get('project_expenses', id)
  if (!existing || existing.project_id !== projectId || existing.deleted_at) throw new NotFoundError()
  if (existing.status === 'conferida') throw new ValidationError('Despesa conferida não pode ser excluída.')
  await ctx.store.softDelete('project_expenses', id)
  await audit(ctx, 'excluir_despesa', 'project_expenses', id, projectId)
}

/** Conferência humana da despesa (gestor financeiro). */
export async function reviewExpense(ctx: Ctx, expenseId: string, input: { status: 'conferida' | 'rejeitada'; note?: string | null }) {
  if (!idSchema.safeParse(expenseId).success) throw new NotFoundError()
  const expense = await ctx.store.get('project_expenses', expenseId)
  if (!expense || expense.deleted_at) throw new NotFoundError()
  const { project } = await getProjectForUser(ctx, expense.project_id)
  if (!canReviewAccountability(ctx.user, project)) throw new PermissionError('Somente o gestor financeiro pode conferir despesas.')
  if (!['conferida', 'rejeitada'].includes(input.status)) throw new ValidationError('Status inválido.')
  if (input.status === 'conferida' && !expense.document_id) throw new ValidationError('Vincule o documento comprobatório antes de conferir a despesa.')
  await ctx.store.update('project_expenses', expenseId, { status: input.status })
  await audit(ctx, 'conferir_despesa', 'project_expenses', expenseId, expense.project_id, { status: input.status, nota: input.note ?? null })
}

// ------------------------------------------------------------ indicadores

export async function updateIndicatorValue(ctx: Ctx, projectId: string, indicatorId: string, value: string) {
  await requireExecution(ctx, projectId)
  const ind = await ctx.store.get('project_indicators', indicatorId)
  if (!ind || ind.project_id !== projectId) throw new NotFoundError()
  const v = optionalText(200).parse(value)
  await ctx.store.update('project_indicators', indicatorId, { current_value: v })
  await audit(ctx, 'atualizar_indicador', 'project_indicators', indicatorId, projectId, { valor: v })
}

// ------------------------------------------------------------ prestação de contas

export async function ensureAccountabilityChecklist(ctx: Ctx, projectId: string) {
  await requireExecution(ctx, projectId)
  const existing = await ctx.store.list('accountability_records', { where: { project_id: projectId } })
  if (existing.length) return
  for (const item of ACCOUNTABILITY_CHECKLIST) {
    await ctx.store.insert('accountability_records', {
      id: newId(),
      project_id: projectId,
      item,
      status: 'pendente',
      document_id: null,
      reviewer_id: null,
      note: null,
      updated_at: nowIso(),
    })
  }
  await audit(ctx, 'criar_checklist_prestacao', 'accountability_records', null, projectId)
}

export async function linkAccountabilityDocument(ctx: Ctx, projectId: string, recordId: string, documentId: string | null) {
  await requireExecution(ctx, projectId)
  const rec = await ctx.store.get('accountability_records', recordId)
  if (!rec || rec.project_id !== projectId) throw new NotFoundError()
  if (rec.status === 'conferido') throw new ValidationError('Item já conferido.')
  await assertDocumentOfProject(ctx, projectId, documentId)
  await ctx.store.update('accountability_records', recordId, {
    document_id: documentId,
    status: documentId ? 'apresentado' : 'pendente',
    updated_at: nowIso(),
  })
  await audit(ctx, 'vincular_evidencia', 'accountability_records', recordId, projectId, { documento: documentId })
}

export async function reviewAccountabilityItem(ctx: Ctx, recordId: string, input: { status: string; note?: string | null }) {
  const parsed = documentStatusSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Status inválido.', zodMessages(parsed.error))
  if (!idSchema.safeParse(recordId).success) throw new NotFoundError()
  const rec = await ctx.store.get('accountability_records', recordId)
  if (!rec) throw new NotFoundError()
  const { project } = await getProjectForUser(ctx, rec.project_id)
  if (!canReviewAccountability(ctx.user, project)) throw new PermissionError('Somente o gestor financeiro pode conferir itens da prestação de contas.')
  if (parsed.data.status === 'conferido' && !rec.document_id) throw new ValidationError('Não é possível conferir item sem evidência vinculada.')
  if (parsed.data.status === 'rejeitado' && !parsed.data.note) throw new ValidationError('Informe o motivo da rejeição.')
  await ctx.store.update('accountability_records', recordId, {
    status: parsed.data.status,
    note: parsed.data.note ?? null,
    reviewer_id: ctx.user.id,
    updated_at: nowIso(),
  })
  await audit(ctx, 'conferir_prestacao', 'accountability_records', recordId, rec.project_id, { status: parsed.data.status })
}
