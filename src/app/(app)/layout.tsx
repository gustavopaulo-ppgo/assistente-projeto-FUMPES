import { AppShell } from '@/components/app-shell'
import { ROLE_LABELS } from '@/features/workflow/config'
import { isDemoMode } from '@/lib/env'
import { canCreateProject, isAdmin } from '@/server/auth/permissions'
import { requireContext } from '@/server/auth/session'
import { getInstitution } from '@/server/settings'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { store, user } = await requireContext()
  const institution = await getInstitution(store)
  const nav = [
    { href: '/painel', label: 'Painel', icon: 'LayoutDashboard' as const },
    { href: '/projetos', label: 'Projetos', icon: 'FolderKanban' as const },
    ...(canCreateProject(user) ? [{ href: '/projetos/novo', label: 'Novo projeto', icon: 'FilePlus2' as const }] : []),
    { href: '/normas', label: 'Base normativa', icon: 'BookOpenCheck' as const },
  ]
  const adminNav = isAdmin(user)
    ? [
        { href: '/admin/usuarios', label: 'Usuários e perfis', icon: 'Users' as const },
        { href: '/admin/unidades', label: 'Unidades', icon: 'Building2' as const },
        { href: '/admin/configuracoes', label: 'Configurações', icon: 'Settings' as const },
        { href: '/admin/auditoria', label: 'Auditoria', icon: 'ScrollText' as const },
      ]
    : []
  return (
    <div style={{ ['--brand' as string]: institution.primary_color, ['--brand-accent' as string]: institution.accent_color }}>
      <AppShell
        systemName={institution.system_name}
        institutionName={institution.institution_name}
        logo={institution.logo_data_url}
        userName={user.profile.full_name}
        roleLabels={[...new Set(user.roles.map((r) => ROLE_LABELS[r.role]))]}
        nav={nav}
        adminNav={adminNav}
        demo={isDemoMode()}
      >
        {children}
      </AppShell>
    </div>
  )
}
