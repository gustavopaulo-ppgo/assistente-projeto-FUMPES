import type { Metadata } from 'next'
import { Alert, Badge, Card, PageHeader } from '@/components/ui'
import { formatDateBR } from '@/features/budget/calc'
import { LegalActions, LegalEditor } from '@/features/legal/components/legal-editor'
import { projectTypeLabel } from '@/features/projects/steps'
import { canManageLegalReferences } from '@/server/auth/permissions'
import { requireContext } from '@/server/auth/session'
import { listLegalReferences } from '@/server/services/legal'

export const metadata: Metadata = { title: 'Base normativa' }

const STATUS = {
  verificada: { tone: 'success', label: 'Verificada' },
  nao_verificada: { tone: 'warning', label: 'Não verificada — a verificar' },
  desatualizada: { tone: 'danger', label: 'Desatualizada' },
} as const

export default async function NormasPage() {
  const ctx = await requireContext()
  const refs = await listLegalReferences(ctx)
  const admin = canManageLegalReferences(ctx.user)
  return (
    <>
      <PageHeader
        title="Base normativa"
        description="Normas e regras usadas na análise preliminar de enquadramento. Somente normas verificadas por responsável são consideradas; a referência cadastrada não confirma, por si, vigência ou aplicabilidade."
      />
      <Alert tone="warning" className="mb-6">
        As normas iniciais foram cadastradas como “a verificar”, sem dispositivos ou regras: o administrador deve conferir o texto na fonte oficial, registrar as regras
        aplicáveis e marcar a verificação. Enquanto isso, as análises indicarão “informação normativa insuficiente”.
      </Alert>
      <div className="space-y-4">
        {refs.map((r) => (
          <Card
            key={r.id}
            title={
              <span>
                {r.number} <span className="font-normal text-slate-600">— {r.title}</span>
              </span>
            }
            actions={<Badge tone={STATUS[r.validation_status].tone}>{STATUS[r.validation_status].label}</Badge>}
          >
            <dl className="grid gap-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-500">Órgão emissor</dt>
                <dd>{r.issuer}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Data</dt>
                <dd>{formatDateBR(r.date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Última verificação</dt>
                <dd>{formatDateBR(r.last_verified_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Fonte oficial</dt>
                <dd>
                  {r.official_url ? (
                    <a href={r.official_url} target="_blank" rel="noopener noreferrer" className="text-brand underline">
                      abrir
                    </a>
                  ) : (
                    <span className="text-amber-800">não informada</span>
                  )}
                </dd>
              </div>
            </dl>
            {r.rules.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {r.rules.map((rule, i) => (
                  <li key={i} className="rounded bg-slate-50 p-2">
                    <Badge tone={rule.effect === 'restringe' ? 'danger' : rule.effect === 'permite' ? 'success' : 'info'}>{rule.effect}</Badge> {rule.summary}
                    {rule.provision && <span className="text-xs text-slate-600"> ({rule.provision})</span>}
                    <p className="text-xs text-slate-500">Tipos: {rule.project_types.map(projectTypeLabel).join('; ')}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Nenhuma regra de enquadramento cadastrada.</p>
            )}
            {admin && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <LegalActions reference={r} />
              </div>
            )}
          </Card>
        ))}
        {admin && (
          <Card title="Cadastrar nova norma">
            <LegalEditor />
          </Card>
        )}
      </div>
    </>
  )
}
