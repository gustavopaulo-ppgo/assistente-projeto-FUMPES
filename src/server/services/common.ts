import crypto from 'node:crypto'
import type { Store } from '@/server/db/types'
import type { SessionUser } from '@/types/domain'
import { z } from 'zod'

export interface Ctx {
  store: Store
  user: SessionUser
}

export const newId = () => crypto.randomUUID()
export const nowIso = () => new Date().toISOString()

/** Registra trilha de auditoria. Nunca grava conteúdo sensível completo — apenas metadados. */
export async function audit(
  ctx: Ctx,
  action: string,
  entity: string,
  entityId: string | null,
  projectId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  await ctx.store.insert('audit_logs', {
    id: newId(),
    actor_id: ctx.user.id,
    action,
    entity,
    entity_id: entityId,
    project_id: projectId,
    details,
    created_at: nowIso(),
  })
}

export async function getSetting<T>(store: Store, key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const row = await store.get('system_settings', key)
  if (!row) return fallback
  const parsed = schema.safeParse(row.value)
  return parsed.success ? parsed.data : fallback
}
