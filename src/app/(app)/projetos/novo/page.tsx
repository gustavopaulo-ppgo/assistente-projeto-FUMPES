import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Card, PageHeader } from '@/components/ui'
import { canCreateProject, hasAnyRole } from '@/server/auth/permissions'
import { requireContext } from '@/server/auth/session'
import { NewProjectForm } from '@/features/projects/components/new-project-form'

export const metadata: Metadata = { title: 'Novo projeto' }

export default async function NovoProjetoPage() {
  const { store, user } = await requireContext()
  if (!canCreateProject(user)) redirect('/projetos')
  const units = (await store.list('organizational_units', { where: { active: true }, orderBy: { column: 'name' } })).filter((u) =>
    hasAnyRole(user, ['proponente', 'gestor_unidade'], u.id),
  )
  return (
    <>
      <PageHeader
        title="Novo projeto"
        description="Comece com poucas informações. Nas próximas etapas, o assistente fará perguntas simples e ajudará a transformar suas respostas em texto técnico."
      />
      <Card className="max-w-2xl">
        <NewProjectForm units={units.map((u) => ({ id: u.id, label: `${u.name} (${u.acronym})` }))} defaultUnit={user.profile.unit_id} />
      </Card>
    </>
  )
}
