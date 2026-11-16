import Link from 'next/link'
import { Download } from 'lucide-react'
import { Badge, Card, Table } from '@/components/ui'
import { formatBRL, formatDateBR } from '@/features/budget/calc'
import { evaluateCompleteness } from '@/features/projects/completeness'
import { STEPS, projectTypeLabel } from '@/features/projects/steps'
import { MembersPanel } from '@/features/projects/components/members-panel'
import { DeleteProjectButton, VersionButton } from '@/features/projects/components/project-misc'
import { TransitionPanel } from '@/features/projects/components/transition-panel'
import { EXECUTION_STATUSES, STATUS_LABELS } from '@/features/workflow/config'
import { allowedTransitions, isAdmin, membership } from '@/server/auth/permissions'
import { loadProjectPage } from '@/server/pages'
import { getWorkflow } from '@/server/services/projects'

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { ctx, bundle } = await loadProjectPage(id)
  const p = bundle.project
  const completeness = evaluateCompleteness(bundle)
  const workflow = await getWorkflow(ctx.store)
  const options = allowedTransitions(workflow, ctx.user, p, bundle.members).map((t) => ({
    to: t.to,
    label: t.label,
    requireNote: t.requireNote,
    requireAdministrativeReference: t.requireAdministrativeReference,
    requireComplete: t.requireComplete,
  }))
  const role = membership(ctx.user, p, bundle.members)
  const actorIds = [...new Set([...bundle.approvals.map((a) => a.actor_id), ...bundle.versions.map((v) => v.created_by)])]
  const people = new Map((actorIds.length ? await ctx.store.list('profiles', { where: { id: actorIds } }) : []).map((x) => [x.id, x.full_name]))
  const memberRows = [
    ...(bundle.owner ? [{ id: 'owner', name: bundle.owner.full_name, role: 'responsavel' as const }] : []),
    ...bundle.members
      .filter((m) => m.user_id !== p.owner_id)
      .map((m) => ({ id: m.id, name: bundle.memberProfiles.find((x) => x.id === m.user_id)?.full_name ?? '—', role: m.member_role })),
  ]
  const exp = (doc: string, format: string) => `/api/projetos/${p.id}/exportar?doc=${doc}&format=${format}`
  const showExecution = EXECUTION_STATUSES.has(p.status) || p.status === 'encerrado'

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="Resumo">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Tipo</dt>
              <dd>{projectTypeLabel(p.project_type)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Área temática</dt>
              <dd>{p.thematic_area ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Unidade</dt>
              <dd>{bundle.unit?.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Responsável</dt>
              <dd>{bundle.owner?.full_name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Valor estimado</dt>
              <dd className="font-semibold">R$ {formatBRL(p.requested_amount)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Valor aprovado (registro interno)</dt>
              <dd>{p.approved_amount ? `R$ ${formatBRL(p.approved_amount)}` : '—'}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Etapas da elaboração">
          <ol className="grid gap-2 sm:grid-cols-2">
            {STEPS.map((s) => {
              const st = completeness.byStep[s.number]
              return (
                <li key={s.number}>
                  <Link href={`/projetos/${p.id}/elaborar/${s.number}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-brand">
                    <span>
                      {s.number}. {s.title}
                    </span>
                    <Badge tone={st.percent === 100 ? 'success' : st.percent > 0 ? 'warning' : 'neutral'}>{st.percent}%</Badge>
                  </Link>
                </li>
              )
            })}
          </ol>
          {completeness.pendings.length > 0 && (
            <p className="mt-3 text-sm text-slate-600">
              {completeness.pendings.length} pendência(s) obrigatória(s).{' '}
              <Link href={`/projetos/${p.id}/elaborar/10`} className="text-brand underline">
                Ver revisão e consolidação
              </Link>
            </p>
          )}
        </Card>

        <Card title="Histórico de tramitação">
          {bundle.approvals.length ? (
            <Table headers={['Data', 'De', 'Para', 'Responsável', 'Observação / referência']}>
              {[...bundle.approvals].reverse().map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{new Date(a.created_at).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2 text-xs">{STATUS_LABELS[a.from_status]}</td>
                  <td className="px-3 py-2 text-xs font-medium">{STATUS_LABELS[a.to_status]}</td>
                  <td className="px-3 py-2 text-xs">{people.get(a.actor_id) ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {a.note}
                    {a.administrative_reference && <p className="mt-1 font-mono text-[11px] text-slate-600">Ref.: {a.administrative_reference}</p>}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-sm text-slate-500">Sem movimentações.</p>
          )}
          <p className="mt-2 text-xs text-slate-500">As situações registradas no sistema não equivalem automaticamente a decisões oficiais nos sistemas administrativos do Estado.</p>
        </Card>

        <Card title="Versões">
          {bundle.versions.length ? (
            <ul className="mb-3 space-y-1 text-sm">
              {bundle.versions.map((v) => (
                <li key={v.id}>
                  <span className="font-semibold">v{v.version_number}</span> — {v.reason} <span className="text-xs text-slate-500">({formatDateBR(v.created_at)}, {people.get(v.created_by) ?? '—'})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-slate-500">Nenhuma versão registrada. Versões são criadas automaticamente ao encaminhar e ao aprovar.</p>
          )}
          {(role || isAdmin(ctx.user)) && <VersionButton projectId={p.id} />}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Tramitação">
          <p className="mb-3 text-sm">
            Situação atual: <strong>{STATUS_LABELS[p.status]}</strong>
          </p>
          <TransitionPanel projectId={p.id} options={options} />
        </Card>

        <Card title="Exportar documentos">
          <ul className="space-y-1.5 text-sm">
            {[
              ['Projeto completo (PDF)', exp('projeto', 'pdf')],
              ['Projeto editável (DOCX)', exp('projeto', 'docx')],
              ['Planilha orçamentária (XLSX)', exp('orcamento', 'xlsx')],
              ['Cronograma físico-financeiro (XLSX)', exp('cronograma', 'xlsx')],
              ['Relatório de pendências (PDF)', exp('pendencias', 'pdf')],
              ['Checklist documental (PDF)', exp('checklist', 'pdf')],
              ...(showExecution ? [['Relatório de execução (PDF)', exp('execucao', 'pdf')]] : []),
            ].map(([label, href]) => (
              <li key={href}>
                <a href={href} className="flex items-center gap-2 text-brand hover:underline">
                  <Download aria-hidden className="h-4 w-4" /> {label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Documentos com pendências saem marcados como MINUTA.</p>
        </Card>

        <Card title="Equipe do projeto">
          <MembersPanel projectId={p.id} members={memberRows} canManage={role === 'responsavel'} />
        </Card>

        {((role === 'responsavel' && ['rascunho', 'em_elaboracao'].includes(p.status)) || isAdmin(ctx.user)) && (
          <Card title="Zona de exclusão">
            <DeleteProjectButton projectId={p.id} />
          </Card>
        )}
      </div>
    </div>
  )
}
