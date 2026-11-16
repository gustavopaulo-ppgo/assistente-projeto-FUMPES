import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Banknote, CheckCircle2, ClipboardList, FileSearch, FolderKanban, Hammer, Hourglass } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, StatCard, Table, inputClass } from '@/components/ui'
import { formatBRL, formatDateBR } from '@/features/budget/calc'
import { PROJECT_TYPES } from '@/features/projects/steps'
import { STATUS_LABELS } from '@/features/workflow/config'
import { canCreateProject } from '@/server/auth/permissions'
import { requireContext } from '@/server/auth/session'
import { getDashboard } from '@/server/services/dashboard'
import { listVisibleProjects } from '@/server/services/projects'
import { dashboardFiltersSchema } from '@/server/validation/schemas'
import { PROJECT_STATUSES } from '@/types/domain'

export const metadata: Metadata = { title: 'Painel' }

export default async function PainelPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireContext()
  const raw = await searchParams
  const parsed = dashboardFiltersSchema.safeParse(raw)
  const filters = parsed.success ? parsed.data : {}
  const [data, visible, units] = await Promise.all([getDashboard(ctx, filters), listVisibleProjects(ctx), ctx.store.list('organizational_units', { orderBy: { column: 'name' } })])
  const ownerIds = [...new Set(visible.map((p) => p.owner_id))]
  const owners = ownerIds.length ? await ctx.store.list('profiles', { where: { id: ownerIds } }) : []
  const maxStatus = Math.max(1, ...data.porStatus.map((s) => s.count))

  return (
    <>
      <PageHeader
        title={`Olá, ${ctx.user.profile.full_name.split(' ')[0]}`}
        description="Visão geral dos projetos que você tem permissão para acompanhar. Os valores vêm diretamente dos registros do sistema."
        actions={canCreateProject(ctx.user) && <LinkButton href="/projetos/novo">Novo projeto</LinkButton>}
      />

      <form method="get" className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-7" aria-label="Filtros do painel">
        <label className="text-xs text-slate-600">
          De
          <input type="date" name="from" defaultValue={raw.from} className={inputClass} />
        </label>
        <label className="text-xs text-slate-600">
          Até
          <input type="date" name="to" defaultValue={raw.to} className={inputClass} />
        </label>
        <label className="text-xs text-slate-600">
          Unidade
          <select name="unit_id" defaultValue={raw.unit_id ?? ''} className={inputClass}>
            <option value="">Todas</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.acronym}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Categoria
          <select name="project_type" defaultValue={raw.project_type ?? ''} className={inputClass}>
            <option value="">Todas</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Responsável
          <select name="owner_id" defaultValue={raw.owner_id ?? ''} className={inputClass}>
            <option value="">Todos</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Situação
          <select name="status" defaultValue={raw.status ?? ''} className={inputClass}>
            <option value="">Todas</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex items-end gap-2 md:col-span-1">
          <button type="submit" className="rounded-md bg-brand px-3 py-2 text-sm text-white">
            Filtrar
          </button>
          <Link href="/painel" className="px-2 py-2 text-sm text-brand">
            Limpar
          </Link>
        </div>
      </form>
      {!parsed.success && <Alert tone="warning" className="mb-4">Filtro inválido ignorado.</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Total de projetos" value={data.total} icon={<FolderKanban className="h-4 w-4" />} />
        <StatCard label="Em elaboração" value={data.elaboracao} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Em análise" value={data.analise} icon={<FileSearch className="h-4 w-4" />} />
        <StatCard label="Aprovados" value={data.aprovados} hint="inclui em execução e concluídos" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Em execução" value={data.execucao} icon={<Hammer className="h-4 w-4" />} />
        <StatCard label="Concluídos" value={data.concluidos} icon={<Hourglass className="h-4 w-4" />} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <StatCard label="Valores solicitados" value={`R$ ${formatBRL(data.valorSolicitado)}`} icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Valores aprovados (registrados)" value={`R$ ${formatBRL(data.valorAprovado)}`} hint="Registro interno; não substitui atos oficiais" icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Valores executados" value={`R$ ${formatBRL(data.valorExecutado)}`} hint="Despesas lançadas, exceto rejeitadas" icon={<Banknote className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Pendências">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Projetos com correção solicitada</span> <Badge tone={data.pendencias.correcoes ? 'danger' : 'neutral'}>{data.pendencias.correcoes}</Badge>
            </li>
            <li className="flex justify-between">
              <span>Despesas aguardando conferência</span> <Badge tone={data.pendencias.despesasAConferir ? 'warning' : 'neutral'}>{data.pendencias.despesasAConferir}</Badge>
            </li>
            <li className="flex justify-between">
              <span>Documentos não conferidos</span> <Badge tone={data.pendencias.documentosPendentes ? 'warning' : 'neutral'}>{data.pendencias.documentosPendentes}</Badge>
            </li>
          </ul>
        </Card>

        <Card title="Prazos críticos (próximos 30 dias)">
          {data.prazosCriticos.length ? (
            <ul className="space-y-2 text-sm">
              {data.prazosCriticos.map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-2">
                  <Link href={`/projetos/${p.projectId}`} className="text-brand hover:underline">
                    <span className="font-mono text-xs">{p.projectCode}</span> — {p.label}
                  </Link>
                  <Badge tone={p.overdue ? 'danger' : 'warning'}>
                    {p.overdue && <AlertTriangle aria-hidden className="h-3 w-3" />}
                    {p.overdue ? 'Vencido' : 'Vence'} {formatDateBR(p.date)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nenhum prazo crítico.</p>
          )}
        </Card>

        <Card title="Projetos por situação">
          {data.porStatus.length ? (
            <ul className="space-y-2" aria-label="Quantidade de projetos por situação">
              {data.porStatus
                .sort((a, b) => b.count - a.count)
                .map((s) => (
                  <li key={s.status} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-2 text-sm" title={`${STATUS_LABELS[s.status]}: ${s.count}`}>
                    <span className="truncate text-slate-700">{STATUS_LABELS[s.status]}</span>
                    <span className="h-3 rounded-r bg-slate-100">
                      <span className="block h-3 rounded-r bg-brand" style={{ width: `${(s.count / maxStatus) * 100}%` }} />
                    </span>
                    <span className="text-right font-medium text-ink">{s.count}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Sem dados.</p>
          )}
        </Card>
      </div>

      <Card title="Projetos recentes" className="mt-6">
        {data.recentes.length ? (
          <Table headers={['Código', 'Título', 'Situação', 'Preenchimento', 'Valor estimado']}>
            {data.recentes.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                <td className="px-3 py-2">
                  <Link className="text-brand hover:underline" href={`/projetos/${p.id}`}>
                    {p.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-3 py-2">{p.completion}%</td>
                <td className="px-3 py-2 text-right">R$ {formatBRL(p.requested_amount)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="Nenhum projeto encontrado">Ajuste os filtros ou crie um novo projeto.</EmptyState>
        )}
      </Card>
    </>
  )
}
