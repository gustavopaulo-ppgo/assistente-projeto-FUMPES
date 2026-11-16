import { z } from 'zod'

/**
 * Leitura e validação das variáveis de ambiente do servidor.
 * Nunca importar este módulo em componentes cliente.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATA_BACKEND: z.enum(['demo', 'supabase']).default('demo'),
  ALLOW_DEMO_IN_PRODUCTION: z.enum(['true', 'false']).default('false'),
  SESSION_SECRET: z.string().optional(),
  DEMO_PERSIST_FILE: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('project-documents'),
  AI_PROVIDER: z.enum(['local', 'gemini', 'openai']).default('local'),
  AI_MODEL: z.string().optional(),
  AI_EXTERNAL_ALLOWED: z.enum(['true', 'false']).default('false'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AI_MAX_REQUESTS_PER_HOUR: z.coerce.number().int().positive().default(60),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(50).default(10),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function env(): Env {
  if (cached && process.env.NODE_ENV !== 'test') return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Configuração de ambiente inválida: ${fields}`)
  }
  cached = parsed.data
  return cached
}

const DEV_SECRET = 'funpes-demo-secret-somente-desenvolvimento-local-0000'

export function sessionSecret(): string {
  const e = env()
  if (e.SESSION_SECRET && e.SESSION_SECRET.length >= 32) return e.SESSION_SECRET
  if (e.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET ausente ou curto (mínimo 32 caracteres) em produção.')
  }
  return DEV_SECRET
}

export function isDemoMode(): boolean {
  return env().DATA_BACKEND === 'demo'
}

/** Garante que o modo demonstração não seja usado em produção sem autorização explícita. */
export function assertDemoAllowed(): void {
  const e = env()
  if (e.DATA_BACKEND === 'demo' && e.NODE_ENV === 'production' && e.ALLOW_DEMO_IN_PRODUCTION !== 'true') {
    throw new Error(
      'Modo demonstração bloqueado em produção. Configure DATA_BACKEND=supabase ou defina ALLOW_DEMO_IN_PRODUCTION=true para ambientes de prévia.',
    )
  }
}
