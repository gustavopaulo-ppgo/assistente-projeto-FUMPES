import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { env, sessionSecret } from '@/lib/env'
import { getStore } from '@/server/db'
import { createSupabaseServerClient } from '@/server/db/supabase'
import type { Store } from '@/server/db/types'
import type { SessionUser } from '@/types/domain'
import { loadSessionUserFromStore } from '@/server/services/users'
import { DEMO_COOKIE, DEMO_PASSWORD, DEMO_SESSION_HOURS, safeEqual, signDemoToken, verifyDemoToken } from './demo-session'

import type { Ctx } from '@/server/services/common'
export type { Ctx }

export const loadSessionUser = (store: Store, userId: string): Promise<SessionUser | null> =>
  loadSessionUserFromStore(store, userId)

async function currentUserId(): Promise<string | null> {
  if (env().DATA_BACKEND === 'supabase') {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    return data.user.id
  }
  const jar = await cookies()
  return verifyDemoToken(jar.get(DEMO_COOKIE)?.value, sessionSecret())
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const uid = await currentUserId()
  if (!uid) return null
  return loadSessionUser(await getStore(), uid)
}

/** Contexto autenticado para Server Components e Server Actions. Redireciona ao login se não houver sessão. */
export async function requireContext(): Promise<Ctx> {
  const uid = await currentUserId()
  if (!uid) redirect('/login')
  const store = await getStore()
  const user = await loadSessionUser(store, uid)
  if (!user) redirect('/login?erro=inativo')
  return { store, user }
}

export type SignInResult = { ok: true } | { ok: false; message: string }

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const generic = { ok: false as const, message: 'E-mail ou senha inválidos.' }
  if (env().DATA_BACKEND === 'supabase') {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? generic : { ok: true }
  }
  const store = await getStore()
  const [profile] = await store.list('profiles', { where: { email: email.toLowerCase() } })
  // compara sempre, para não revelar a existência do e-mail pelo tempo de resposta
  const passwordOk = safeEqual(password, DEMO_PASSWORD)
  if (!profile || !profile.active || !passwordOk) return generic
  const jar = await cookies()
  jar.set(DEMO_COOKIE, signDemoToken(profile.id, sessionSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().NODE_ENV === 'production',
    path: '/',
    maxAge: DEMO_SESSION_HOURS * 3600,
  })
  return { ok: true }
}

export async function signOut(): Promise<void> {
  if (env().DATA_BACKEND === 'supabase') {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
    return
  }
  const jar = await cookies()
  jar.delete(DEMO_COOKIE)
}
