'use client'

import { useRef, useState } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import { Feedback, useServerAction } from '@/components/action-feedback'
import { Badge, Button, Field, inputClass } from '@/components/ui'
import { ACCEPT_ATTR } from '@/server/files/validate'
import { deleteDocumentAction, setDocumentStatusAction, uploadDocumentAction } from '@/server/actions/projects'
import type { DocumentContext, DocumentStatus } from '@/types/domain'

export interface DocRow {
  id: string
  name: string
  category: string
  status: DocumentStatus
  size: number
  review_note: string | null
  created_at: string
}

const STATUS_TONE = { pendente: 'neutral', apresentado: 'info', conferido: 'success', rejeitado: 'danger' } as const
const STATUS_LABEL = { pendente: 'Pendente', apresentado: 'Apresentado', conferido: 'Conferido', rejeitado: 'Rejeitado' }

export function DocumentsPanel({
  projectId,
  context,
  documents,
  categories,
  canUpload,
  canReview,
  maxMb,
}: {
  projectId: string
  context: DocumentContext
  documents: DocRow[]
  categories: string[]
  canUpload: boolean
  canReview: boolean
  maxMb: number
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState(categories[0] ?? 'Outros')
  const { pending, result, execute } = useServerAction()

  return (
    <div className="space-y-4">
      {canUpload && (
        <form
          className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            const file = fileRef.current?.files?.[0]
            if (!file) return
            const fd = new FormData()
            fd.set('file', file)
            fd.set('category', category)
            fd.set('context', context)
            execute(() => uploadDocumentAction(projectId, fd), () => {
              if (fileRef.current) fileRef.current.value = ''
            })
          }}
        >
          <Field label="Tipo de documento" htmlFor={`cat-${context}`}>
            <select id={`cat-${context}`} value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {[...categories, 'Outros'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Arquivo" htmlFor={`file-${context}`} help={`PDF, imagem (PNG/JPEG), DOCX, XLSX ou CSV — até ${maxMb} MB. Não envie dados pessoais de custodiados.`}>
            <input id={`file-${context}`} ref={fileRef} type="file" accept={ACCEPT_ATTR} required className="block w-full text-sm" />
          </Field>
          <Button type="submit" disabled={pending}>
            <Upload aria-hidden className="h-4 w-4" /> {pending ? 'Enviando…' : 'Anexar'}
          </Button>
        </form>
      )}
      <Feedback result={result} />
      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum documento anexado.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <a href={`/api/documentos/${d.id}`} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  <Download aria-hidden className="h-3.5 w-3.5" /> {d.name}
                </a>
                <p className="text-xs text-slate-500">
                  {d.category} · {(d.size / 1024).toFixed(0)} KB · {new Date(d.created_at).toLocaleDateString('pt-BR')}
                  {d.review_note && ` · Obs.: ${d.review_note}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                {canReview && d.status !== 'conferido' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => execute(() => setDocumentStatusAction(projectId, d.id, 'conferido'))}>
                      Conferir
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const note = prompt('Motivo da rejeição:')
                        if (note) execute(() => setDocumentStatusAction(projectId, d.id, 'rejeitado', note))
                      }}
                    >
                      Rejeitar
                    </Button>
                  </>
                )}
                {canUpload && d.status !== 'conferido' && (
                  <button
                    type="button"
                    aria-label={`Excluir ${d.name}`}
                    className="rounded p-1 text-red-700 hover:bg-red-50"
                    onClick={() => confirm(`Excluir o documento "${d.name}"?`) && execute(() => deleteDocumentAction(projectId, d.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
