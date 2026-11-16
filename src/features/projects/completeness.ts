import Decimal from 'decimal.js'
import { parseDecimal, summarizeBudget } from '@/features/budget/calc'
import type { ProjectBundle } from '@/types/bundle'
import { STEPS, type StepDef } from './steps'

export interface Pending {
  step: number
  field: string
  message: string
  severity: 'obrigatorio' | 'alerta'
}

export interface Completeness {
  percent: number
  byStep: Record<number, { done: number; total: number; percent: number }>
  pendings: Pending[]
  inconsistencies: Pending[]
}

const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0

export function fieldValue(bundle: ProjectBundle, step: StepDef, key: string): string {
  if (step.kind === 'identification' && key in bundle.project) {
    const v = (bundle.project as unknown as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : ''
  }
  return bundle.sections[step.section]?.content?.[key] ?? ''
}

/** Avalia o preenchimento de todas as etapas. */
export function evaluateCompleteness(bundle: ProjectBundle): Completeness {
  const pendings: Pending[] = []
  const byStep: Completeness['byStep'] = {}
  let totalChecks = 0
  let doneChecks = 0

  for (const step of STEPS) {
    let total = 0
    let done = 0
    const check = (ok: boolean, field: string, message: string) => {
      total += 1
      if (ok) done += 1
      else pendings.push({ step: step.number, field, message, severity: 'obrigatorio' })
    }
    for (const f of step.fields) {
      if (f.required) check(filled(fieldValue(bundle, step, f.key)), f.key, `${f.label} não preenchido`)
    }
    switch (step.kind) {
      case 'objectives':
        check(bundle.objectives.length > 0, 'objectives', 'Informe ao menos um objetivo específico')
        check(bundle.indicators.length > 0, 'indicators', 'Informe ao menos um indicador de desempenho')
        break
      case 'budget': {
        check(bundle.budget.length > 0, 'budget', 'Inclua ao menos um item no orçamento')
        const errors = summarizeBudget(bundle.budget).issues.filter((i) => i.severity === 'erro')
        check(errors.length === 0, 'budget_issues', `Orçamento com ${errors.length} campo(s) obrigatório(s) incompleto(s) ou inválido(s)`)
        break
      }
      case 'schedule':
        check(bundle.schedule.length > 0, 'schedule', 'Inclua ao menos uma atividade no cronograma')
        check(
          bundle.schedule.every((s) => s.start_date && s.end_date),
          'schedule_dates',
          'Todas as atividades devem ter data de início e de término',
        )
        break
      case 'risks':
        check(bundle.risks.length > 0, 'risks', 'Identifique ao menos um risco')
        break
      case 'documents':
        check(
          bundle.documents.some((d) => d.context === 'elaboracao'),
          'documents',
          'Anexe ao menos um documento (evidência, levantamento ou cotação)',
        )
        break
    }
    byStep[step.number] = { done, total, percent: total ? Math.round((done / total) * 100) : 100 }
    totalChecks += total
    doneChecks += done
  }

  return {
    percent: totalChecks ? Math.round((doneChecks / totalChecks) * 100) : 0,
    byStep,
    pendings,
    inconsistencies: findInconsistencies(bundle),
  }
}

/** Inconsistências lógicas entre etapas (alertas para revisão humana). */
export function findInconsistencies(bundle: ProjectBundle): Pending[] {
  const out: Pending[] = []
  const add = (step: number, field: string, message: string) => out.push({ step, field, message, severity: 'alerta' })

  const summary = summarizeBudget(bundle.budget)
  for (const issue of summary.issues.filter((i) => i.severity === 'alerta')) {
    add(6, issue.field, `Item ${issue.itemIndex + 1}: ${issue.message}`)
  }
  const budgetTotal = new Decimal(summary.total)
  const planned = bundle.schedule.reduce((acc, s) => acc.add(parseDecimal(s.planned_amount) ?? 0), new Decimal(0))
  if (planned.gt(0) && !planned.eq(budgetTotal)) {
    add(7, 'planned_amount', `Desembolso do cronograma (R$ ${planned.toFixed(2)}) difere do total do orçamento (R$ ${budgetTotal.toFixed(2)})`)
  }
  const byId = new Map(bundle.schedule.map((s) => [s.id, s]))
  for (const s of bundle.schedule) {
    if (s.start_date && s.end_date && s.end_date < s.start_date) add(7, 'end_date', `Atividade "${s.activity}" termina antes de começar`)
    const dep = s.depends_on ? byId.get(s.depends_on) : undefined
    if (dep?.end_date && s.start_date && s.start_date < dep.end_date) {
      add(7, 'depends_on', `Atividade "${s.activity}" começa antes do término da atividade da qual depende ("${dep.activity}")`)
    }
  }
  for (const r of bundle.risks) {
    if (r.probability * r.impact >= 12 && !filled(r.mitigation)) add(8, 'mitigation', `Risco elevado sem medida de mitigação: "${r.description}"`)
  }
  for (const ind of bundle.indicators) {
    if (!filled(ind.target)) add(4, 'target', `Indicador "${ind.name}" sem meta definida`)
    if (!filled(ind.baseline)) add(4, 'baseline', `Indicador "${ind.name}" sem linha de base`)
  }
  const reqAmount = parseDecimal(bundle.project.requested_amount) ?? new Decimal(0)
  if (!reqAmount.eq(budgetTotal)) add(6, 'requested_amount', 'Valor solicitado do projeto diverge do total do orçamento')
  return out
}
