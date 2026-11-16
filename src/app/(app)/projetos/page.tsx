import type { Metadata } from 'next'
import Link from 'next/link'
import { StatusBadge } from '@/components/status-badge'
import { Card, EmptyState, LinkButton, PageHeader, ProgressBar, Table, inputClass } from '@/components/ui'
import { formatBRL, formatDateBR } from '@/features/budget/calc'
import { projectTypeLabel } from '@/features/projects/steps'
import { STATUS_LABELS } from '@/features/workflow/config'
import { canCreateProject } from '@/server/auth/permissions'
import { requireContext } from '@/server/auth/session'
import { listVisibleProjects } from '@/server/services/projects'
import { PROJECT_STATUSES } from '@/types/domain'

export const metadata: Metadata = { title: 'Projetos' }

export default async function ProjetosPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const ctx = await requireContext()
  const { q = '', status = '' } = await searchParams
  const term = q.trim().toLowerCase().slice(0, 100)
  const all = await listVisibleProjects(ctx)
  const projects = all.filter((p) => (!term || `${p.code} ${p.title}`.toLowerCase().includes(term)) && (!status || p.status === status))
  const units = new Map((await ctx.store.list('organizational_units')).map((u) => [u.id, u.acronym]))

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Projetos que você elabora, colabora ou tem atribuição para analisar."
        actions={canCreateProject(ctx.user) && <LinkButton href="/projetos/novo">Novo projeto</LinkButton>}
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="q">
          Buscar
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Buscar por código ou título" className={`${inputClass} max-w-sm`} />
        <label className="sr-only" htmlFor="status">
          Situação
        </label>
        <select id="status" name="status" defaultValue={status} className={`${inputClass} max-w-xs`}>
          <option value="">Todas as situações</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-brand px-4 py-2 text-sm text-white" type="submit">
          Buscar
        </button>
      </form>
      <Card>
        {projects.length ? (
          <Table headers={['Código', 'Projeto', 'Unidade', 'Situação', 'Preenchimento', 'Valor estimado', 'Atualizado']}>
            {projects.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{p.code}</td>
                <td className="px-3 py-2">
                  <Link href={`/projetos/${p.id}`} className="font-medium text-brand hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-xs text-slate-500">{projectTypeLabel(p.project_type)}</p>
                </td>
                <td className="px-3 py-2 text-xs">{units.get(p.unit_id)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={p.status} />
                </td>
                <td className="w-32 px-3 py-2">
                  <ProgressBar value={p.completion} label="" />
                  <span className="text-xs text-slate-500">{p.completion}%</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">R$ {formatBRL(p.requested_amount)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDateBR(p.updated_at)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="Nenhum projeto encontrado">{canCreateProject(ctx.user) ? 'Crie um novo projeto para começar.' : 'Não há projetos disponíveis para o seu perfil.'}</EmptyState>
        )}
      </Card>
    </>
  )
}
