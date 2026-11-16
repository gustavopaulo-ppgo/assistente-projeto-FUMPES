import crypto from 'node:crypto'

/**
 * Token de sessão do MODO DEMONSTRAÇÃO: payload + HMAC-SHA256.
 * Em produção com Supabase, a sessão é gerida pelo Supabase Auth.
 */
export const DEMO_COOKIE = 'funpes_demo_session'
export const DEMO_SESSION_HOURS = 8
/** Senha única dos usuários fictícios de demonstração (documentada no README). */
export const DEMO_PASSWORD = 'demo-funpes'

interface Payload {
  uid: string
  exp: number
}

export function signDemoToken(uid: string, secret: string, now = Date.now()): string {
  const payload: Payload = { uid, exp: now + DEMO_SESSION_HOURS * 3_600_000 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyDemoToken(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token || token.length > 1000) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Payload
    if (typeof payload.uid !== 'string' || typeof payload.exp !== 'number' || payload.exp < now) return null
    return payload.uid
  } catch {
    return null
  }
}

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}
