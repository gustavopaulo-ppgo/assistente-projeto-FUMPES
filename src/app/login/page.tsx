import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { isDemoMode } from '@/lib/env'
import { getSessionUser } from '@/server/auth/session'
import { getStore } from '@/server/db'
import { DEMO_PASSWORD } from '@/server/auth/demo-session'
import { ROLE_LABELS } from '@/features/workflow/config'
import { getInstitution } from '@/server/settings'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Acesso' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getSessionUser()) redirect('/painel')
  const { erro } = await searchParams
  const store = await getStore()
  const institution = await getInstitution(store)
  const demo = isDemoMode()
  const demoUsers = demo
    ? await Promise.all(
        (await store.list('profiles', { where: { active: true }, orderBy: { column: 'full_name' } })).map(async (p) => ({
          email: p.email,
          name: p.full_name,
          roles: (await store.list('user_roles', { where: { user_id: p.id } })).map((r) => ROLE_LABELS[r.role]),
        })),
      )
    : []

  return (
    <main className="flex min-h-screen items-center justify-center p-4" style={{ ['--brand' as string]: institution.primary_color }}>
      <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-lg md:grid md:grid-cols-2">
        <div className="bg-brand p-8 text-white">
          {institution.logo_data_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={institution.logo_data_url} alt="Logotipo institucional" className="mb-6 h-16 w-auto" />
          ) : (
            <ShieldCheck aria-hidden className="mb-6 h-12 w-12 opacity-90" />
          )}
          <p className="text-sm uppercase tracking-wider opacity-80">{institution.institution_name}</p>
          <h1 className="mt-2 text-2xl font-bold">{institution.system_name}</h1>
          <p className="mt-3 text-sm opacity-90">Plataforma de elaboração, acompanhamento e prestação de contas de projetos do {institution.department_name}.</p>
          <p className="mt-6 text-xs opacity-75">
            O assistente de IA apoia a redação técnica e não substitui a análise humana nem decide sobre projetos ou recursos.
          </p>
        </div>
        <div className="p-8">
          <h2 className="text-lg font-semibold">Acessar o sistema</h2>
          {erro === 'inativo' && <p className="mt-2 text-sm text-red-700">Usuário inativo ou sem perfil cadastrado.</p>}
          {erro === 'link' && <p className="mt-2 text-sm text-red-700">Link de acesso inválido ou expirado. Solicite um novo convite ao administrador.</p>}
          <LoginForm />
          {demo && (
            <div className="mt-6 rounded-md bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
              <p className="font-semibold">Modo demonstração — somente dados fictícios</p>
              <p className="mt-1">
                Senha de todos os usuários fictícios: <code className="font-mono">{DEMO_PASSWORD}</code>
              </p>
              <ul className="mt-2 space-y-1">
                {demoUsers.map((u) => (
                  <li key={u.email}>
                    <code className="font-mono">{u.email}</code> — {u.roles.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
