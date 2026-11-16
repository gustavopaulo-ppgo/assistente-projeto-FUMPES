import { defineConfig } from '@playwright/test'

const PORT = 3100

/**
 * Testes ponta a ponta no modo demonstração (dados fictícios em memória).
 * Usa o navegador instalado (Edge por padrão; PW_CHANNEL=chrome para Chrome).
 * Pré-requisito: `npm run build`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // msedge (padrão local no Windows), chrome, ou 'bundled' para o Chromium do Playwright (CI)
    channel: process.env.PW_CHANNEL === 'bundled' ? undefined : (process.env.PW_CHANNEL ?? 'msedge'),
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATA_BACKEND: 'demo',
      ALLOW_DEMO_IN_PRODUCTION: 'true',
      SESSION_SECRET: 'e2e-segredo-de-teste-com-mais-de-32-caracteres',
      AI_PROVIDER: 'local',
    },
  },
})
