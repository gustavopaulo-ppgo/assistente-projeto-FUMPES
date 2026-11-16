import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { NotFoundError, PermissionError, ValidationError } from '@/server/auth/permissions'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; details?: string[] }

/** Executa uma ação traduzindo erros conhecidos e ocultando detalhes internos. */
export async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    return { ok: true, data, message }
  } catch (e) {
    unstable_rethrow(e)
    if (e instanceof ValidationError) return { ok: false, error: e.message, details: e.details }
    if (e instanceof PermissionError || e instanceof NotFoundError) return { ok: false, error: e.message }
    console.error('[acao] erro inesperado:', e)
    return { ok: false, error: 'Não foi possível concluir a operação. Tente novamente; se o problema persistir, contate o administrador.' }
  }
}
