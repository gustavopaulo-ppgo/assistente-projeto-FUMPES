import { redirect } from 'next/navigation'
import { isAdmin } from '@/server/auth/permissions'
import { requireContext } from '@/server/auth/session'

/** Barreira de navegação; cada serviço administrativo revalida a permissão no servidor. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireContext()
  if (!isAdmin(user)) redirect('/painel')
  return children
}
