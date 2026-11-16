import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/server/db/supabase'
import { SetPasswordForm } from './set-password-form'

export const metadata: Metadata = { title: 'Definir senha' }

export default async function DefinirSenhaPage() {
  if (env().DATA_BACKEND !== 'supabase') redirect('/login')
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login?erro=link')
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-lg font-semibold">Definir senha de acesso</h1>
        <p className="mt-1 text-sm text-slate-600">Conta: {data.user.email}</p>
        <SetPasswordForm />
      </div>
    </main>
  )
}
