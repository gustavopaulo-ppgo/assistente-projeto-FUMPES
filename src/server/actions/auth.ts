'use server'

import { redirect } from 'next/navigation'
import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/server/db/supabase'
import type { ActionResult } from './run'

export async function setPasswordAction(_: unknown, form: FormData): Promise<ActionResult> {
  if (env().DATA_BACKEND !== 'supabase') return { ok: false, error: 'Indisponível no modo demonstração.' }
  const password = String(form.get('password') ?? '')
  if (password !== String(form.get('confirm') ?? '')) return { ok: false, error: 'As senhas não conferem.' }
  if (password.length < 12 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, error: 'A senha deve ter de 12 a 128 caracteres, com letras e números.' }
  }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { ok: false, error: 'Não foi possível definir a senha. Solicite um novo convite.' }
  redirect('/painel')
}
