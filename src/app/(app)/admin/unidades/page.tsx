import type { Metadata } from 'next'
import { Card, PageHeader } from '@/components/ui'
import { UnitEditor } from '@/features/admin/components/admin-forms'
import { requireContext } from '@/server/auth/session'

export const metadata: Metadata = { title: 'Unidades' }

export default async function UnidadesPage() {
  const ctx = await requireContext()
  const units = await ctx.store.list('organizational_units', { orderBy: { column: 'name' } })
  return (
    <>
      <PageHeader title="Unidades organizacionais" description="Unidades proponentes e de lotação. Unidades inativas não podem receber novos projetos." />
      <Card title="Unidades cadastradas">
        <div className="space-y-3">
          {units.map((u) => (
            <UnitEditor key={u.id} unit={{ id: u.id, name: u.name, acronym: u.acronym, city: u.city, active: u.active }} />
          ))}
        </div>
      </Card>
      <Card title="Nova unidade" className="mt-6">
        <UnitEditor />
      </Card>
    </>
  )
}
