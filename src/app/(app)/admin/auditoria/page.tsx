import type { Metadata } from 'next'
import { Card, PageHeader, Table } from '@/components/ui'
import { requireContext } from '@/server/auth/session'
import { listAuditLogs } from '@/server/services/admin'

export const metadata: Metadata = { title: 'Auditoria' }

export default async function AuditoriaPage() {
  const ctx = await requireContext()
  const logs = await listAuditLogs(ctx, 300)
  const actorIds = [...new Set(logs.map((l) => l.actor_id).filter((x): x is string => Boolean(x)))]
  const actors = new Map((actorIds.length ? await ctx.store.list('profiles', { where: { id: actorIds } }) : []).map((p) => [p.id, p.full_name]))
  return (
    <>
      <PageHeader title="Trilha de auditoria" description="Últimos 300 registros: usuário, data/hora, ação e entidade. Os registros não armazenam o conteúdo sensível, apenas metadados." />
      <Card>
        <Table headers={['Data/hora', 'Usuário', 'Ação', 'Entidade', 'Detalhes']}>
          {logs.map((l) => (
            <tr key={l.id} className="align-top">
              <td className="whitespace-nowrap px-3 py-1.5 text-xs">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
              <td className="px-3 py-1.5 text-xs">{l.actor_id ? (actors.get(l.actor_id) ?? l.actor_id) : 'sistema'}</td>
              <td className="px-3 py-1.5 text-xs font-medium">{l.action}</td>
              <td className="px-3 py-1.5 text-xs">
                {l.entity}
                {l.entity_id && <span className="block font-mono text-[10px] text-slate-500">{l.entity_id}</span>}
              </td>
              <td className="max-w-md break-words px-3 py-1.5 font-mono text-[11px] text-slate-600">{JSON.stringify(l.details)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  )
}
