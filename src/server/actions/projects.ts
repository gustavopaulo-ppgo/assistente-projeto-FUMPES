'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { env } from '@/lib/env'
import { requireContext, signIn, signOut } from '@/server/auth/session'
import { aiOptions } from '@/server/ai-config'
import { getFileStorage } from '@/server/storage'
import { askAssistant, recordSuggestionDecision } from '@/server/services/ai'
import { deleteDocument, setDocumentStatus, uploadDocument } from '@/server/services/documents'
import {
  addMember,
  createProject,
  createVersion,
  deleteProject,
  removeMember,
  saveStep,
  saveTableRows,
  transitionProject,
  type SaveStepInput,
} from '@/server/services/projects'
import { addReview } from '@/server/services/reviews'
import type { TableEntity } from '@/server/validation/schemas'
import type { DocumentContext, ProjectStatus } from '@/types/domain'
import { run, type ActionResult } from './run'

// ------------------------------------------------------------ autenticação

export async function loginAction(_: unknown, form: FormData): Promise<ActionResult> {
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 200)
  const password = String(form.get('password') ?? '').slice(0, 200)
  if (!email || !password) return { ok: false, error: 'Informe e-mail e senha.' }
  const res = await signIn(email, password)
  if (!res.ok) return { ok: false, error: res.message }
  redirect('/painel')
}

export async function logoutAction() {
  await signOut()
  redirect('/login')
}

// ------------------------------------------------------------ projetos

export async function createProjectAction(_: unknown, form: FormData): Promise<ActionResult> {
  const ctx = await requireContext()
  const res = await run(() =>
    createProject(ctx, {
      title: String(form.get('title') ?? ''),
      unit_id: String(form.get('unit_id') ?? ''),
      project_type: String(form.get('project_type') ?? ''),
      thematic_area: (form.get('thematic_area') as string) || null,
    }),
  )
  if (!res.ok) return res
  redirect(`/projetos/${res.data!.id}/elaborar/1`)
}

export async function saveStepAction(projectId: string, step: number, input: SaveStepInput) {
  const ctx = await requireContext()
  const res = await run(async () => {
    const p = await saveStep(ctx, projectId, step, input)
    return { completion: p.completion, status: p.status }
  }, 'Etapa salva.')
  revalidatePath(`/projetos/${projectId}`, 'layout')
  return res
}

export async function saveTableAction(projectId: string, entity: TableEntity, rows: unknown[]) {
  const ctx = await requireContext()
  const res = await run(async () => {
    const p = await saveTableRows(ctx, projectId, entity, rows)
    return { completion: p.completion, requested_amount: p.requested_amount }
  }, 'Dados salvos.')
  revalidatePath(`/projetos/${projectId}`, 'layout')
  return res
}

export async function transitionAction(projectId: string, input: { to: ProjectStatus; note?: string; administrative_reference?: string }) {
  const ctx = await requireContext()
  const res = await run(() => transitionProject(ctx, projectId, input).then(() => undefined), 'Situação atualizada.')
  revalidatePath(`/projetos/${projectId}`, 'layout')
  revalidatePath('/painel')
  return res
}

export async function createVersionAction(projectId: string, reason: string) {
  const ctx = await requireContext()
  const res = await run(() => createVersion(ctx, projectId, reason || 'Versão salva manualmente'), 'Versão registrada.')
  revalidatePath(`/projetos/${projectId}`)
  return res
}

export async function deleteProjectAction(projectId: string) {
  const ctx = await requireContext()
  const res = await run(() => deleteProject(ctx, projectId))
  if (!res.ok) return res
  revalidatePath('/projetos')
  redirect('/projetos')
}

export async function addMemberAction(projectId: string, email: string, member_role: 'colaborador' | 'leitor') {
  const ctx = await requireContext()
  const res = await run(() => addMember(ctx, projectId, { email, member_role }), 'Membro adicionado.')
  revalidatePath(`/projetos/${projectId}`)
  return res
}

export async function removeMemberAction(projectId: string, memberId: string) {
  const ctx = await requireContext()
  const res = await run(() => removeMember(ctx, projectId, memberId), 'Membro removido.')
  revalidatePath(`/projetos/${projectId}`)
  return res
}

export async function addReviewAction(projectId: string, input: { review_type: string; recommendation: string; opinion: string }) {
  const ctx = await requireContext()
  const res = await run(() => addReview(ctx, projectId, input as never).then(() => undefined), 'Parecer registrado.')
  revalidatePath(`/projetos/${projectId}`, 'layout')
  return res
}

// ------------------------------------------------------------ documentos

export async function uploadDocumentAction(projectId: string, form: FormData) {
  const ctx = await requireContext()
  const file = form.get('file')
  if (!(file instanceof File)) return { ok: false as const, error: 'Selecione um arquivo.' }
  const res = await run(async () => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const doc = await uploadDocument(
      ctx,
      getFileStorage(),
      projectId,
      { name: file.name, bytes, category: String(form.get('category') ?? ''), context: String(form.get('context') ?? 'elaboracao') as DocumentContext },
      env().UPLOAD_MAX_MB * 1024 * 1024,
    )
    return { id: doc.id, name: doc.name }
  }, 'Documento anexado.')
  revalidatePath(`/projetos/${projectId}`, 'layout')
  return res
}

export async function setDocumentStatusAction(projectId: string, documentId: string, status: string, note?: string) {
  const ctx = await requireContext()
  const res = await run(() => setDocumentStatus(ctx, documentId, { status, note }), 'Classificação registrada.')
  revalidatePath(`/projetos/${projectId}`, 'layout')
  return res
}

export async function deleteDocumentAction(projectId: string, documentId: string) {
  const ctx = await requireContext()
  const res = await run(() => deleteDocument(ctx, documentId), 'Documento removido.')
  revalidatePath(`/projetos/${projectId}`, 'layout')
  return res
}

// ------------------------------------------------------------ assistente de IA

export async function askAssistantAction(projectId: string, step: number, message: string) {
  const ctx = await requireContext()
  return run(() => askAssistant(ctx, projectId, { step, message }, aiOptions()))
}

export async function suggestionDecisionAction(interactionId: string, field: string, accepted: boolean) {
  const ctx = await requireContext()
  return run(() => recordSuggestionDecision(ctx, interactionId, field, accepted))
}
