import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Sistema Inteligente FUNPES', template: '%s · Sistema Inteligente FUNPES' },
  description: 'Plataforma de Elaboração e Gestão de Projetos — Polícia Penal de Goiás',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  )
}
