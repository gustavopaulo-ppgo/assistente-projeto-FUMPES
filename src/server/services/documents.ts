import crypto from 'node:crypto'
import { z } from 'zod'
import {
  NotFoundError,
  PermissionError,
  ValidationError,
  canEditContent,
  canManageExecution,
  canReviewDocuments,
} from '@/server/auth/permissions'
import type { FileStorage } from '@/server/storage'
import { storageSafeName, validateUpload } from '@/server/files/validate'
import { documentStatusSchema, optionalText, requiredText, zodMessages } from '@/server/validation/schemas'
import type { DocumentContext, ProjectDocument } from '@/types/domain'
import { audit, newId, nowIso, type Ctx } from './common'
import { getProjectForUser } from './projects'

const uploadMetaSchema = z.object({
  category: requiredText(120, 'Categoria'),
  context: z.enum(['elaboracao', 'execucao', 'prestacao_contas']),
  description: optionalText(300),
})

export interface UploadInput {
  name: string
  bytes: Uint8Array
  category: string
  context: DocumentContext
}

export async function uploadDocument(
  ctx: Ctx,
  storage: FileStorage,
  projectId: string,
  input: UploadInput,
  maxBytes: number,
): Promise<ProjectDocument> {
  const meta = uploadMetaSchema.safeParse({ category: input.category, context: input.context })
  if (!meta.success) throw new ValidationError('Dados do documento inválidos.', zodMessages(meta.error))
  const { project, members } = await getProjectForUser(ctx, projectId)
  const allowed =
    meta.data.context === 'elaboracao' ? canEditContent(ctx.user, project, members) : canManageExecution(ctx.user, project, members)
  if (!allowed) {
    await audit(ctx, 'acesso_negado', 'project_documents', null, projectId, { motivo: 'upload', contexto: meta.data.context })
    throw new PermissionError('Você não pode anexar documentos neste projeto ou nesta fase.')
  }
  const check = validateUpload(input.name, input.bytes, maxBytes)
  if (!check.ok) {
    await audit(ctx, 'upload_rejeitado', 'project_documents', null, projectId, { motivo: check.reason })
    throw new ValidationError(check.reason)
  }
  const id = newId()
  const key = `${projectId}/${id}/${storageSafeName(check.safeName)}`
  await storage.put(key, input.bytes, check.mime)
  const doc: ProjectDocument = {
    id,
    project_id: projectId,
    context: meta.data.context,
    category: meta.data.category,
    name: check.safeName,
    storage_path: key,
    mime_type: check.mime,
    size_bytes: input.bytes.length,
    sha256: crypto.createHash('sha256').update(input.bytes).digest('hex'),
    status: 'apresentado',
    review_note: null,
    uploaded_by: ctx.user.id,
    created_at: nowIso(),
    deleted_at: null,
  }
  await ctx.store.insert('project_documents', doc)
  await audit(ctx, 'upload', 'project_documents', id, projectId, { nome: doc.name, tamanho: doc.size_bytes, sha256: doc.sha256 })
  return doc
}

async function getDocForUser(ctx: Ctx, documentId: string) {
  const doc = await ctx.store.get('project_documents', documentId)
  if (!doc || doc.deleted_at) throw new NotFoundError('Documento não encontrado.')
  const access = await getProjectForUser(ctx, doc.project_id) // verifica permissão de visualização
  return { doc, ...access }
}

export async function getDocumentDownload(ctx: Ctx, storage: FileStorage, documentId: string) {
  const { doc } = await getDocForUser(ctx, documentId)
  await audit(ctx, 'download', 'project_documents', doc.id, doc.project_id)
  const url = await storage.signedUrl(doc.storage_path, 60, doc.name)
  if (url) return { doc, url, bytes: null }
  const bytes = await storage.get(doc.storage_path)
  if (!bytes) throw new NotFoundError('Arquivo indisponível no armazenamento.')
  return { doc, url: null, bytes }
}

/** Classificação do documento pela revisão humana. */
export async function setDocumentStatus(ctx: Ctx, documentId: string, input: { status: string; note?: string | null }) {
  const parsed = documentStatusSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Status inválido.', zodMessages(parsed.error))
  const { doc, project, members } = await getDocForUser(ctx, documentId)
  const { status, note } = parsed.data
  const isReviewDecision = status === 'conferido' || status === 'rejeitado'
  if (isReviewDecision && !canReviewDocuments(ctx.user, project)) {
    throw new PermissionError('Somente analistas/gestores autorizados podem conferir ou rejeitar documentos.')
  }
  if (!isReviewDecision && !canReviewDocuments(ctx.user, project) && !canManageExecution(ctx.user, project, members) && !canEditContent(ctx.user, project, members)) {
    throw new PermissionError()
  }
  if (status === 'rejeitado' && !note) throw new ValidationError('Informe o motivo da rejeição.')
  await ctx.store.update('project_documents', doc.id, { status, review_note: note ?? null })
  await audit(ctx, 'classificar_documento', 'project_documents', doc.id, doc.project_id, { de: doc.status, para: status })
}

export async function deleteDocument(ctx: Ctx, documentId: string) {
  const { doc, project, members } = await getDocForUser(ctx, documentId)
  const allowed = doc.context === 'elaboracao' ? canEditContent(ctx.user, project, members) : canManageExecution(ctx.user, project, members)
  if (!allowed) throw new PermissionError()
  if (doc.status === 'conferido') throw new ValidationError('Documento já conferido não pode ser excluído.')
  await ctx.store.softDelete('project_documents', doc.id)
  await audit(ctx, 'excluir_documento', 'project_documents', doc.id, doc.project_id, { nome: doc.name })
}
