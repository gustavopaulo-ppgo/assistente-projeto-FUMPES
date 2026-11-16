import type { Store } from '@/server/db/types'
import type { SessionUser } from '@/types/domain'

export async function loadSessionUserFromStore(store: Store, userId: string): Promise<SessionUser | null> {
  const profile = await store.get('profiles', userId)
  if (!profile || !profile.active) return null
  const roles = await store.list('user_roles', { where: { user_id: userId } })
  return { id: userId, profile, roles }
}
