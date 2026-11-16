import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

function credentials() {
  const e = env()
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }
  return { url: e.NEXT_PUBLIC_SUPABASE_URL, anonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY }
}

/** Cliente vinculado à sessão do usuário (RLS aplicada). */
export async function createSupabaseServerClient() {
  const { url, anonKey } = credentials()
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // chamado a partir de Server Component: a renovação ocorre no proxy
        }
      },
    },
  })
}

/**
 * Cliente com chave de serviço — IGNORA RLS. Uso restrito a operações
 * administrativas já autorizadas no servidor (ex.: convite de usuários,
 * URLs assinadas do Storage). Nunca expor ao cliente.
 */
export function createSupabaseAdminClient() {
  const e = env()
  const { url } = credentials()
  if (!e.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.')
  return createClient(url, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}
