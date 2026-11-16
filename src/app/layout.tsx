import type { Metadata, Viewport } from 'next'
import { connection } from 'next/server'
import { configurationProblems } from '@/lib/env'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Sistema Inteligente FUNPES', template: '%s · Sistema Inteligente FUNPES' },
  description: 'Plataforma de Elaboração e Gestão de Projetos — Polícia Penal de Goiás',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

/** Página de orientação quando o ambiente não está configurado (em vez de erro genérico). */
function ConfigurationNeeded({ problems }: { problems: string[] }) {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="rounded-lg border border-amber-300 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-ink">Configuração do ambiente pendente</h1>
        <p className="mt-2 text-sm text-slate-700">O sistema foi publicado, mas as variáveis de ambiente necessárias ainda não foram definidas pelo operador:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-800">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-700">
          Na Vercel: <strong>Project → Settings → Environment Variables</strong>, cadastre as variáveis e faça um novo deploy (<strong>Deployments → Redeploy</strong>). Consulte{' '}
          <code>docs/DEPLOY.md</code> e <code>.env.example</code> no repositório.
        </p>
      </div>
    </main>
  )
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection() // avalia a configuração em cada requisição (não no build)
  const problems = configurationProblems()
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">{problems.length ? <ConfigurationNeeded problems={problems} /> : children}</body>
    </html>
  )
}
