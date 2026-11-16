'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/components/ui'

export function ProjectTabs({ projectId, hasExecution }: { projectId: string; hasExecution: boolean }) {
  const pathname = usePathname()
  const base = `/projetos/${projectId}`
  const tabs = [
    { href: base, label: 'Visão geral', active: pathname === base },
    { href: `${base}/elaborar/1`, label: 'Elaboração', active: pathname.startsWith(`${base}/elaborar`) },
    { href: `${base}/analise`, label: 'Análise e pareceres', active: pathname.startsWith(`${base}/analise`) },
    ...(hasExecution ? [{ href: `${base}/execucao`, label: 'Execução e prestação de contas', active: pathname.startsWith(`${base}/execucao`) }] : []),
  ]
  return (
    <nav aria-label="Seções do projeto" className="relative -mb-4 mt-4 flex gap-1 overflow-x-auto border-t border-slate-100 pt-2">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? 'page' : undefined}
          className={cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm', t.active ? 'border-brand font-semibold text-brand' : 'border-transparent text-slate-600 hover:text-ink')}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
