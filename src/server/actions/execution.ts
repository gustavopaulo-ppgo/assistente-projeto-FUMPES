'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/server/auth/session'
import {
  deleteDeliverable,
  deleteExpense,
  ensureAccountabilityChecklist,
  linkAccountabilityDocument,
  reviewAccountabilityItem,
  reviewExpense,
  saveDeliverable,
  saveExpense,
  updateIndicatorValue,
} from '@/server/services/execution'
import { run } from './run'

const path = (id: string) => `/projetos/${id}/execucao`

export async function saveDeliverableAction(projectId: string, input: Record<string, unknown>) {
  const ctx = await requireContext()
  const res = await run(() => saveDeliverable(ctx, projectId, input as never), 'Entrega salva.')
  revalidatePath(path(projectId))
  return res
}

export async function deleteDeliverableAction(projectId: string, id: string) {
  const ctx = await requireContext()
  const res = await run(() => deleteDeliverable(ctx, projectId, id), 'Entrega excluída.')
  revalidatePath(path(projectId))
  return res
}

export async function saveExpenseAction(projectId: string, input: Record<string, unknown>) {
  const ctx = await requireContext()
  const res = await run(() => saveExpense(ctx, projectId, input as never), 'Despesa registrada.')
  revalidatePath(path(projectId))
  return res
}

export async function deleteExpenseAction(projectId: string, id: string) {
  const ctx = await requireContext()
  const res = await run(() => deleteExpense(ctx, projectId, id), 'Despesa excluída.')
  revalidatePath(path(projectId))
  return res
}

export async function reviewExpenseAction(projectId: string, id: string, status: 'conferida' | 'rejeitada', note?: string) {
  const ctx = await requireContext()
  const res = await run(() => reviewExpense(ctx, id, { status, note }), 'Conferência registrada.')
  revalidatePath(path(projectId))
  return res
}

export async function updateIndicatorAction(projectId: string, indicatorId: string, value: string) {
  const ctx = await requireContext()
  const res = await run(() => updateIndicatorValue(ctx, projectId, indicatorId, value), 'Indicador atualizado.')
  revalidatePath(path(projectId))
  return res
}

export async function ensureChecklistAction(projectId: string) {
  const ctx = await requireContext()
  const res = await run(() => ensureAccountabilityChecklist(ctx, projectId), 'Checklist criado.')
  revalidatePath(path(projectId))
  return res
}

export async function linkEvidenceAction(projectId: string, recordId: string, documentId: string | null) {
  const ctx = await requireContext()
  const res = await run(() => linkAccountabilityDocument(ctx, projectId, recordId, documentId), 'Evidência vinculada.')
  revalidatePath(path(projectId))
  return res
}

export async function reviewAccountabilityAction(projectId: string, recordId: string, status: string, note?: string) {
  const ctx = await requireContext()
  const res = await run(() => reviewAccountabilityItem(ctx, recordId, { status, note }), 'Conferência registrada.')
  revalidatePath(path(projectId))
  return res
}
