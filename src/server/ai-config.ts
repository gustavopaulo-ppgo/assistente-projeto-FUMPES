import 'server-only'
import { selectProvider } from '@/ai'
import { env } from '@/lib/env'
import type { AskOptions } from '@/server/services/ai'

export function aiOptions(): AskOptions {
  const e = env()
  const { provider, notice } = selectProvider({
    provider: e.AI_PROVIDER,
    model: e.AI_MODEL,
    externalAllowed: e.AI_EXTERNAL_ALLOWED === 'true',
    geminiKey: e.GEMINI_API_KEY,
    openaiKey: e.OPENAI_API_KEY,
  })
  return { provider, notice, timeoutMs: e.AI_TIMEOUT_MS, maxPerHour: e.AI_MAX_REQUESTS_PER_HOUR }
}
