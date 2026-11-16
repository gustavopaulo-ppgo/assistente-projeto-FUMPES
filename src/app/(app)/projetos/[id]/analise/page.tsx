import { Badge, Card, Table } from '@/components/ui'
import { formatBRL, summarizeBudget } from '@/features/budget/calc'
import { analyzeFraming } from '@/features/legal/framing'
import { evaluateCompleteness } from '@/features/projects/completeness'
import { DocumentsPanel } from '@/features/projects/components/documents-panel'
import { ReviewForm } from '@/features/projects/components/review-form'
import { env } from '@/lib/env'
import { canReviewDocuments, membership, reviewTypesFor } from '@/server/auth/permissions'
import { loadProjectPage } from '@/server/pages'

const REC = {
  favoravel: { tone: 'success', label: 'Favorável' },
  correcao: { tone: 'warning', label: 'Necessita correção' },
  desfavoravel: { tone: 'danger', label: 'Desfavorável' },
  informativa: { tone: 'info', label: 'Informativa' },
} as const
const TYPE = { gestor_unidade: 'Gestor da unidade', tecnica: 'Análise técnica', financeira: 'Análise financeira' }

export default async function AnalisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { ctx, bundle } = await loadProjectPage(id)
  const p = bundle.project
  const own = Boolean(membership(ctx.user, p, bundle.members))
  const types = own ? [] : reviewTypesFor(ctx.user, p)
  const reviewers = bundle.reviews.length ? await ctx.store.list('profiles', { where: { id: [...new Set(bundle.reviews.map((r) => r.reviewer_id))] } }) : []
  const names = new Map(reviewers.map((r) => [r.id, r.full_name]))
  const completeness = evaluateCompleteness(bundle)
  const budget = summarizeBudget(bundle.budget)
  const framing = analyzeFraming(bundle, await ctx.store.list('legal_references'))
  const docs = bundle.documents.map((d) => ({ id: d.id, name: d.name, category: d.category, status: d.status, size: d.size_bytes, review_note: d.review_note, created_at: d.created_at }))

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="Pareceres registrados">
          {bundle.reviews.length ? (
            <ul className="space-y-3">
              {[...bundle.reviews].reverse().map((r) => (
                <li key={r.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{TYPE[r.review_type]}</strong>
                    <Badge tone={REC[r.recommendation].tone}>{REC[r.recommendation].label}</Badge>
                    <span className="text-xs text-slate-500">
                      {names.get(r.reviewer_id)} · {new Date(r.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap">{r.opinion}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nenhum parecer registrado.</p>
          )}
        </Card>

        {types.length > 0 && (
          <Card title="Registrar parecer">
            <ReviewForm projectId={p.id} types={types} />
          </Card>
        )}

        <Card title="Verificação documental">
          <DocumentsPanel
            projectId={p.id}
            context="elaboracao"
            documents={docs}
            categories={[]}
            canUpload={false}
            canReview={canReviewDocuments(ctx.user, p)}
            maxMb={env().UPLOAD_MAX_MB}
          />
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Apoio à análise">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Pendências obrigatórias</span>
              <Badge tone={completeness.pendings.length ? 'danger' : 'success'}>{completeness.pendings.length}</Badge>
            </li>
            <li className="flex justify-between">
              <span>Inconsistências</span>
              <Badge tone={completeness.inconsistencies.length ? 'warning' : 'success'}>{completeness.inconsistencies.length}</Badge>
            </li>
            <li className="flex justify-between">
              <span>Itens de orçamento</span>
              <span>{budget.itemCount}</span>
            </li>
            <li className="flex justify-between">
              <span>Total do orçamento</span>
              <strong>R$ {formatBRL(budget.total)}</strong>
            </li>
          </ul>
        </Card>
        <Card title="Orçamento por categoria">
          <Table headers={['Categoria', 'Subtotal']}>
            {budget.byCategory.map((c) => (
              <tr key={c.category}>
                <td className="px-3 py-1.5 text-xs">{c.category}</td>
                <td className="px-3 py-1.5 text-right text-xs">R$ {formatBRL(c.subtotal)}</td>
              </tr>
            ))}
          </Table>
          {budget.issues.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-amber-900">
              {budget.issues.slice(0, 10).map((i, k) => (
                <li key={k}>
                  Item {i.itemIndex + 1}: {i.message}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Enquadramento preliminar">
          <p className="text-sm font-semibold">{framing.label}</p>
          <p className="mt-1 text-xs text-slate-600">{framing.hypothesis}</p>
          <p className="mt-2 text-[11px] text-slate-500">{framing.disclaimer}</p>
        </Card>
      </div>
    </div>
  )
}
