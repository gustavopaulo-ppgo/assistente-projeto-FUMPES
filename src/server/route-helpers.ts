import 'server-only'
import { NotFoundError, PermissionError, ValidationError } from '@/server/auth/permissions'
import { getSessionUser } from '@/server/auth/session'
import { getStore } from '@/server/db'
import type { Ctx } from '@/server/services/common'

export async function routeContext(): Promise<Ctx | null> {
  const user = await getSessionUser()
  if (!user) return null
  return { store: await getStore(), user }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ValidationError) return Response.json({ error: e.message, details: e.details }, { status: 422 })
  if (e instanceof PermissionError) return Response.json({ error: e.message }, { status: 403 })
  if (e instanceof NotFoundError) return Response.json({ error: e.message }, { status: 404 })
  console.error('[api] erro inesperado:', e)
  return Response.json({ error: 'Erro interno.' }, { status: 500 })
}

/** Content-Disposition seguro (RFC 6266) para nomes com acentos. */
export function attachment(filename: string): string {
  const ascii = filename.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
