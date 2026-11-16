import { analyzeFraming } from '@/features/legal/framing'
import { ValidationError } from '@/server/auth/permissions'
import { renderDocx } from '@/server/exports/docx'
import { buildChecklistReport, buildExecutionReport, buildPendingReport, buildProjectDocument } from '@/server/exports/model'
import { renderPdf } from '@/server/exports/pdf'
import { renderBudgetXlsx } from '@/server/exports/xlsx'
import {
  DEFAULT_DOCUMENT_TEMPLATE,
  DEFAULT_INSTITUTION,
  SETTING_KEYS,
  documentTemplateSchema,
  institutionSchema,
} from '@/server/settings/defaults'
import { audit, getSetting, type Ctx } from './common'
import { getBundleForUser } from './projects'

export const EXPORTS = {
  projeto: ['pdf', 'docx'],
  orcamento: ['xlsx'],
  cronograma: ['xlsx'],
  pendencias: ['pdf', 'docx'],
  checklist: ['pdf', 'docx'],
  execucao: ['pdf', 'docx'],
} as const
export type ExportDoc = keyof typeof EXPORTS
export type ExportFormat = 'pdf' | 'docx' | 'xlsx'

const MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function exportDocument(ctx: Ctx, projectId: string, doc: string, format: string) {
  if (!(doc in EXPORTS) || !(EXPORTS[doc as ExportDoc] as readonly string[]).includes(format)) {
    throw new ValidationError('Combinação de documento e formato inválida.')
  }
  const bundle = await getBundleForUser(ctx, projectId) // verifica permissão de visualização
  const [template, institution, references] = await Promise.all([
    getSetting(ctx.store, SETTING_KEYS.documentTemplate, documentTemplateSchema, DEFAULT_DOCUMENT_TEMPLATE),
    getSetting(ctx.store, SETTING_KEYS.institution, institutionSchema, DEFAULT_INSTITUTION),
    ctx.store.list('legal_references'),
  ])
  const framing = analyzeFraming(bundle, references)
  const fmt = format as ExportFormat
  let bytes: Uint8Array
  let base: string

  if (doc === 'orcamento' || doc === 'cronograma') {
    bytes = await renderBudgetXlsx(bundle, doc)
    base = `${bundle.project.code}-${doc}`
  } else {
    const model =
      doc === 'projeto'
        ? buildProjectDocument(bundle, template, institution, framing)
        : doc === 'pendencias'
          ? buildPendingReport(bundle, framing, institution)
          : doc === 'checklist'
            ? buildChecklistReport(bundle, framing, institution)
            : buildExecutionReport(bundle, institution)
    bytes = fmt === 'pdf' ? await renderPdf(model) : await renderDocx(model)
    base = model.fileBase
  }
  await audit(ctx, 'exportar', 'projects', projectId, projectId, { documento: doc, formato: fmt })
  return { bytes, filename: `${base}.${fmt}`, mime: MIME[fmt] }
}
