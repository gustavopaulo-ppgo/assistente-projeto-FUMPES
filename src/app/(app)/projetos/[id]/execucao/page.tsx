import { Alert, Card, ProgressBar, StatCard, Table } from '@/components/ui'
import { formatBRL } from '@/features/budget/calc'
import { AccountabilityPanel, DeliverablesPanel, ExpensesPanel, IndicatorsPanel } from '@/features/execution/components/execution-panels'
import { executionSummary } from '@/features/execution/summary'
import { DocumentsPanel } from '@/features/projects/components/documents-panel'
import { EXECUTION_STATUSES } from '@/features/workflow/config'
import { env } from '@/lib/env'
import { canManageExecution, canReviewAccountability } from '@/server/auth/permissions'
import { loadProjectPage } from '@/server/pages'

export default async function ExecucaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { ctx, bundle } = await loadProjectPage(id)
  const p = bundle.project
  const canManage = canManageExecution(ctx.user, p, bundle.members)
  const canReview = canReviewAccountability(ctx.user, p)
  const summary = executionSummary(bundle)
  const execDocs = bundle.documents.filter((d) => d.context !== 'elaboracao')
  const docOpts = execDocs.map((d) => ({ id: d.id, label: `${d.name} (${d.category})` }))
  const budgetOpts = bundle.budget.map((b) => ({ id: b.id, label: b.description.slice(0, 60) }))

  if (!EXECUTION_STATUSES.has(p.status) && p.status !== 'encerrado') {
    return <Alert tone="info">A execução só pode ser acompanhada após o início da execução do projeto aprovado.</Alert>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Previsto" value={`R$ ${formatBRL(summary.planned)}`} />
        <StatCard label="Executado" value={`R$ ${formatBRL(summary.executed)}`} hint={`Conferido: R$ ${formatBRL(summary.executedConfirmed)}`} />
        <StatCard label="Saldo" value={`R$ ${formatBRL(summary.balance)}`} />
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <ProgressBar value={summary.financialPercent} label="Execução financeira" />
          <ProgressBar value={summary.physicalPercent} label="Execução física" />
        </div>
      </div>

      {summary.inconsistencies.length > 0 && (
        <Alert tone="warning" title="Inconsistências identificadas">
          <ul className="list-disc pl-4">
            {summary.inconsistencies.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card title="Previsto × executado por item">
        <Table headers={['Item', 'Previsto', 'Executado', 'Saldo', '%']}>
          {summary.lines.map((l) => (
            <tr key={l.budgetItemId ?? 'nv'}>
              <td className="px-3 py-1.5 text-xs">{l.description}</td>
              <td className="px-3 py-1.5 text-right text-xs">R$ {formatBRL(l.planned)}</td>
              <td className="px-3 py-1.5 text-right text-xs">R$ {formatBRL(l.executed)}</td>
              <td className="px-3 py-1.5 text-right text-xs">R$ {formatBRL(l.balance)}</td>
              <td className="px-3 py-1.5 text-right text-xs">{l.percent}%</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Metas e entregas (execução física)">
        <DeliverablesPanel projectId={p.id} items={bundle.deliverables} docs={docOpts} canManage={canManage} />
      </Card>

      <Card title="Despesas (execução financeira)">
        <ExpensesPanel projectId={p.id} items={bundle.expenses} budgetItems={budgetOpts} docs={docOpts} canManage={canManage} canReview={canReview} />
      </Card>

      <Card title="Indicadores">
        <IndicatorsPanel projectId={p.id} items={bundle.indicators} canManage={canManage} />
      </Card>

      <Card title="Documentos de execução e prestação de contas">
        <DocumentsPanel
          projectId={p.id}
          context={p.status === 'prestacao_contas' ? 'prestacao_contas' : 'execucao'}
          documents={execDocs.map((d) => ({ id: d.id, name: d.name, category: d.category, status: d.status, size: d.size_bytes, review_note: d.review_note, created_at: d.created_at }))}
          categories={['Nota fiscal', 'Comprovante de pagamento', 'Termo de recebimento / atesto', 'Registro patrimonial', 'Registro fotográfico', 'Lista de presença', 'Relatório']}
          canUpload={canManage}
          canReview={canReview}
          maxMb={env().UPLOAD_MAX_MB}
        />
      </Card>

      <Card title="Checklist de prestação de contas">
        <AccountabilityPanel projectId={p.id} records={bundle.accountability} docs={docOpts} canManage={canManage} canReview={canReview} />
      </Card>
    </div>
  )
}
