import 'server-only'
import path from 'node:path'
import { assertDemoAllowed, env } from '@/lib/env'
import { MemoryStore } from './memory-store'
import { buildDemoSeed } from './seed'
import { createSupabaseServerClient } from './supabase'
import { SupabaseStore } from './supabase-store'
import type { Store } from './types'

const globalForStore = globalThis as unknown as { __funpesDemoStore?: MemoryStore }

function demoStore(): MemoryStore {
  if (!globalForStore.__funpesDemoStore) {
    const e = env()
    const file = e.DEMO_PERSIST_FILE ?? (e.NODE_ENV === 'development' ? '.data/demo-db.json' : undefined)
    globalForStore.__funpesDemoStore = file
      ? MemoryStore.fromFile(path.resolve(/*turbopackIgnore: true*/ process.cwd(), file), buildDemoSeed)
      : new MemoryStore(buildDemoSeed())
  }
  return globalForStore.__funpesDemoStore
}

/** Store do request atual (Supabase com sessão do usuário, ou memória no modo demo). */
export async function getStore(): Promise<Store> {
  if (env().DATA_BACKEND === 'supabase') {
    return new SupabaseStore(await createSupabaseServerClient())
  }
  assertDemoAllowed()
  return demoStore()
}

/** Reinicia os dados de demonstração (apenas modo demo). */
export function resetDemoStore(): void {
  globalForStore.__funpesDemoStore = undefined
}
