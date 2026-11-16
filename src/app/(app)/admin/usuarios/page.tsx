import type { Metadata } from 'next'
import { Alert, Card, PageHeader } from '@/components/ui'
import { UserEditor, UserRowItem } from '@/features/admin/components/admin-forms'
import { isDemoMode } from '@/lib/env'
import { requireContext } from '@/server/auth/session'
import { listUsers } from '@/server/services/admin'

export const metadata: Metadata = { title: 'Usuários e perfis' }

export default async function UsuariosPage() {
  const ctx = await requireContext()
  const [users, units] = await Promise.all([listUsers(ctx), ctx.store.list('organizational_units', { orderBy: { column: 'name' } })])
  const unitOpts = units.map((u) => ({ id: u.id, name: u.name, acronym: u.acronym, city: u.city, active: u.active }))
  return (
    <>
      <PageHeader title="Usuários e perfis" description="Gerencie perfis de acesso por função e unidade. Os papéis são verificados no servidor a cada operação." />
      {!isDemoMode() && (
        <Alert tone="info" className="mb-4">
          Com Supabase, a conta de acesso é criada por convite no painel do Supabase (Authentication → Users). O perfil é criado automaticamente no primeiro acesso; aqui você define
          unidade e papéis.
        </Alert>
      )}
      <Card title={`Usuários (${users.length})`}>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <UserRowItem key={u.id} user={{ ...u, roles: u.roles.map((r) => ({ role: r.role, unit_id: r.unit_id })) }} units={unitOpts} />
          ))}
        </ul>
      </Card>
      {isDemoMode() && (
        <Card title="Novo usuário (modo demonstração)" className="mt-6">
          <UserEditor units={unitOpts} />
        </Card>
      )}
    </>
  )
}
