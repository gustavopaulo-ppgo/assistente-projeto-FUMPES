import { MemoryStore } from '@/server/db/memory-store'
import { buildDemoSeed, DEMO_IDS } from '@/server/db/seed'
import { loadSessionUserFromStore } from '@/server/services/users'
import type { Ctx } from '@/server/services/common'

export { DEMO_IDS }

export function freshStore() {
  return new MemoryStore(buildDemoSeed())
}

export async function ctxFor(store: MemoryStore, userId: string): Promise<Ctx> {
  const user = await loadSessionUserFromStore(store, userId)
  if (!user) throw new Error('usuário de teste inexistente')
  return { store, user }
}
