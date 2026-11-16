import Decimal from 'decimal.js'
import { money, parseDecimal, percent } from '@/features/budget/calc'
import type { ProjectBundle } from '@/types/bundle'

export interface ExecutionLine {
  budgetItemId: string | null
  description: string
  planned: string
  executed: string
  balance: string
  percent: number
}

export interface ExecutionSummary {
  planned: string
  approved: string | null
  executed: string
  executedConfirmed: string
  balance: string
  financialPercent: number
  physicalPercent: number
  lines: ExecutionLine[]
  inconsistencies: string[]
}

/** Comparação previsto × executado e detecção de inconsistências da execução. */
export function executionSummary(bundle: ProjectBundle, today = new Date().toISOString().slice(0, 10)): ExecutionSummary {
  const expenses = bundle.expenses.filter((e) => !e.deleted_at && e.status !== 'rejeitada')
  const byItem = new Map<string | null, Decimal>()
  for (const e of expenses) {
    const key = e.budget_item_id && bundle.budget.some((b) => b.id === e.budget_item_id) ? e.budget_item_id : null
    byItem.set(key, (byItem.get(key) ?? new Decimal(0)).add(parseDecimal(e.amount) ?? 0))
  }
  const lines: ExecutionLine[] = bundle.budget.map((b) => {
    const executed = byItem.get(b.id) ?? new Decimal(0)
    const planned = parseDecimal(b.total) ?? new Decimal(0)
    return {
      budgetItemId: b.id,
      description: b.description,
      planned: money(planned),
      executed: money(executed),
      balance: money(planned.sub(executed)),
      percent: percent(money(executed), money(planned)),
    }
  })
  const unlinked = byItem.get(null)
  if (unlinked) {
    lines.push({ budgetItemId: null, description: 'Despesas não vinculadas a item do orçamento', planned: '0.00', executed: money(unlinked), balance: money(unlinked.neg()), percent: 0 })
  }
  const planned = bundle.budget.reduce((a, b) => a.add(parseDecimal(b.total) ?? 0), new Decimal(0))
  const executed = expenses.reduce((a, e) => a.add(parseDecimal(e.amount) ?? 0), new Decimal(0))
  const confirmed = expenses.filter((e) => e.status === 'conferida').reduce((a, e) => a.add(parseDecimal(e.amount) ?? 0), new Decimal(0))
  const reference = bundle.project.approved_amount ? (parseDecimal(bundle.project.approved_amount) ?? planned) : planned

  const inconsistencies: string[] = []
  for (const l of lines) {
    if (l.budgetItemId && new Decimal(l.executed).gt(l.planned)) inconsistencies.push(`Despesas do item "${l.description}" superam o valor previsto.`)
  }
  if (unlinked) inconsistencies.push('Há despesas não vinculadas a itens do orçamento.')
  if (executed.gt(reference)) inconsistencies.push('O total executado supera o valor aprovado/previsto.')
  for (const e of expenses) {
    if (!e.document_id) inconsistencies.push(`Despesa "${e.description}" sem documento comprobatório vinculado.`)
    if (!e.invoice_number) inconsistencies.push(`Despesa "${e.description}" sem número de nota fiscal/comprovante.`)
    if (e.payment_date && e.issue_date && e.payment_date < e.issue_date) inconsistencies.push(`Despesa "${e.description}" com pagamento anterior à emissão do documento.`)
  }
  for (const d of bundle.deliverables) {
    if (d.status !== 'entregue' && d.status !== 'cancelada' && d.planned_date && d.planned_date < today) {
      inconsistencies.push(`Entrega "${d.goal}" com prazo vencido (${d.planned_date}).`)
    }
    if (d.status === 'entregue' && !d.document_id) inconsistencies.push(`Entrega "${d.goal}" registrada sem evidência vinculada.`)
  }
  const active = bundle.deliverables.filter((d) => d.status !== 'cancelada')
  const physical = active.length ? Math.round(active.reduce((a, d) => a + d.physical_progress, 0) / active.length) : 0

  return {
    planned: money(planned),
    approved: bundle.project.approved_amount,
    executed: money(executed),
    executedConfirmed: money(confirmed),
    balance: money(reference.sub(executed)),
    financialPercent: percent(money(executed), money(reference)),
    physicalPercent: physical,
    lines,
    inconsistencies,
  }
}
