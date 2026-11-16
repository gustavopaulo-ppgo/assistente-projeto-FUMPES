import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/server/db/supabase'

const ALLOWED: EmailOtpType[] = ['invite', 'recovery', 'signup', 'email']

/**
 * Confirmação de convite / recuperação de senha do Supabase Auth.
 * Modelo de e-mail: {{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const fail = NextResponse.redirect(new URL('/login?erro=link', url.origin))
  if (env().DATA_BACKEND !== 'supabase' || !tokenHash || !type || !ALLOWED.includes(type)) return fail
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) return fail
  return NextResponse.redirect(new URL(type === 'invite' || type === 'recovery' ? '/auth/definir-senha' : '/painel', url.origin))
}
