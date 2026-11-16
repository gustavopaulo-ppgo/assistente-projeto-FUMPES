import { afterEach, describe, expect, it, vi } from 'vitest'
import { configurationProblems } from '@/lib/env'

describe('diagnóstico de configuração do ambiente', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('produção sem variáveis: aponta modo demo não autorizado e SESSION_SECRET ausente', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATA_BACKEND', '')
    vi.stubEnv('SESSION_SECRET', '')
    const p = configurationProblems()
    expect(p.join(' ')).toMatch(/ALLOW_DEMO_IN_PRODUCTION/)
    expect(p.join(' ')).toMatch(/SESSION_SECRET/)
    expect(p.join(' ')).not.toMatch(/=\s*\S{10,}/) // nunca expõe valores
  })

  it('demonstração autorizada em produção com segredo válido: sem problemas', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATA_BACKEND', 'demo')
    vi.stubEnv('ALLOW_DEMO_IN_PRODUCTION', 'true')
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(40))
    expect(configurationProblems()).toEqual([])
  })

  it('supabase sem URL/chave: aponta as variáveis faltantes', () => {
    vi.stubEnv('DATA_BACKEND', 'supabase')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    expect(configurationProblems()).toHaveLength(2)
  })
})
