import { sumDecimals } from '@/features/budget/calc'
import type { DashboardFilters } from '@/server/validation/schemas'
import type { Project, ProjectStatus } from '@/types/domain'
import type { Ctx } from './common'
import { listVisibleProjects } from './projects'

const GROUPS: Record<string, ProjectStatus[]> = {
  elaboracao: ['rascunho', 'em_elaboracao', 'correcao_solicitada'],
  analise: ['encaminhado', 'em_analise', 'validado_tecnicamente', 'aguardando_decisao'],
  aprovados: ['aprovado', 'em_execucao', 'concluido', 'prestacao_contas', 'encerrado'],
  execucao: ['em_execucao'],
  concluidos: ['concluido', 'prestacao_contas', 'encerrado'],
}

export interface CriticalDeadline {
  projectId: string
  projectCode: string
  label: string
  date: string
  overdue: boolean
}

export interface DashboardData {
  total: number
  elaboracao: number
  analise: number
  aprovados: number
  execucao: number
  concluidos: number
  rejeitados: number
  valorSolicitado: string
  valorAprovado: string
  valorExecutado: string
  pendencias: { correcoes: number; despesasAConferir: number; documentosPendentes: number }
  prazosCriticos: CriticalDeadline[]
  porStatus: { status: ProjectStatus; count: number }[]
  recentes: Project[]
}

export function applyFilters(projects: Project[], f: DashboardFilters): Project[] {
  return projects.filter((p) => {
    if (f.unit_id && p.unit_id !== f.unit_id) return false
    if (f.project_type && p.project_type !== f.project_type) return false
    if (f.owner_id && p.owner_id !== f.owner_id) return false
    if (f.status && p.status !== f.status) return false
    if (f.from && p.created_at.slice(0, 10) < f.from) return false
    if (f.to && p.created_at.slice(0, 10) > f.to) return false
    return true
  })
}

/** Indicadores do painel — calculados apenas sobre os projetos que o usuário pode ver. */
export async function getDashboard(ctx: Ctx, filters: DashboardFilters, today = new Date()): Promise<DashboardData> {
  const projects = applyFilters(await listVisibleProjects(ctx), filters)
  const ids = projects.map((p) => p.id)
  const [expenses, schedule, deliverables, documents] = ids.length
    ? await Promise.all([
        ctx.store.list('project_expenses', { where: { project_id: ids } }),
        ctx.store.list('project_schedule', { where: { project_id: ids } }),
        ctx.store.list('project_deliverables', { where: { project_id: ids } }),
        ctx.store.list('project_documents', { where: { project_id: ids } }),
      ])
    : [[], [], [], []]
  const count = (g: ProjectStatus[]) => projects.filter((p) => g.includes(p.status)).length
  const byId = new Map(projects.map((p) => [p.id, p]))
  const todayIso = today.toISOString().slice(0, 10)
  const horizon = new Date(today.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)

  const prazos: CriticalDeadline[] = []
  for (const s of schedule) {
    const p = byId.get(s.project_id)
    if (!p || !['aprovado', 'em_execucao'].includes(p.status) || !s.end_date) continue
    if (s.end_date <= horizon) {
      prazos.push({ projectId: p.id, projectCode: p.code, label: `Atividade: ${s.activity}`, date: s.end_date, overdue: s.end_date < todayIso })
    }
  }
  for (const d of deliverables) {
    const p = byId.get(d.project_id)
    if (!p || d.status === 'entregue' || d.status === 'cancelada' || !d.planned_date) continue
    if (d.planned_date <= horizon) {
      prazos.push({ projectId: p.id, projectCode: p.code, label: `Entrega: ${d.goal}`, date: d.planned_date, overdue: d.planned_date < todayIso })
    }
  }
  prazos.sort((a, b) => a.date.localeCompare(b.date))

  const statusCounts = new Map<ProjectStatus, number>()
  for (const p of projects) statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1)

  return {
    total: projects.length,
    elaboracao: count(GROUPS.elaboracao),
    analise: count(GROUPS.analise),
    aprovados: count(GROUPS.aprovados),
    execucao: count(GROUPS.execucao),
    concluidos: count(GROUPS.concluidos),
    rejeitados: count(['rejeitado']),
    valorSolicitado: sumDecimals(projects.map((p) => p.requested_amount)),
    valorAprovado: sumDecimals(projects.filter((p) => GROUPS.aprovados.includes(p.status)).map((p) => p.approved_amount)),
    valorExecutado: sumDecimals(expenses.filter((e) => !e.deleted_at && e.status !== 'rejeitada').map((e) => e.amount)),
    pendencias: {
      correcoes: count(['correcao_solicitada']),
      despesasAConferir: expenses.filter((e) => !e.deleted_at && e.status === 'lancada').length,
      documentosPendentes: documents.filter((d) => !d.deleted_at && (d.status === 'pendente' || d.status === 'apresentado')).length,
    },
    prazosCriticos: prazos.slice(0, 15),
    porStatus: [...statusCounts.entries()].map(([status, c]) => ({ status, count: c })),
    recentes: projects.slice(0, 8),
  }
}
