'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import {
  BookOpenCheck,
  Building2,
  FilePlus2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { cn } from './ui'
import { logoutAction } from '@/server/actions/projects'

interface NavItem {
  href: string
  label: string
  icon: keyof typeof ICONS
}
const ICONS = { LayoutDashboard, FolderKanban, FilePlus2, BookOpenCheck, Users, Building2, Settings, ScrollText }

export interface ShellProps {
  children: ReactNode
  systemName: string
  institutionName: string
  logo: string | null
  userName: string
  roleLabels: string[]
  nav: NavItem[]
  adminNav: NavItem[]
  demo: boolean
}

export function AppShell({ children, systemName, institutionName, logo, userName, roleLabels, nav, adminNav, demo }: ShellProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const link = (item: NavItem) => {
    const Icon = ICONS[item.icon]
    const active = pathname === item.href || (item.href !== '/painel' && pathname.startsWith(item.href + '/')) || pathname === item.href
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={active ? 'page' : undefined}
          className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm', active ? 'bg-white/15 font-semibold text-white' : 'text-white/85 hover:bg-white/10')}
        >
          <Icon aria-hidden className="h-4 w-4" /> {item.label}
        </Link>
      </li>
    )
  }

  const sidebar = (
    <nav aria-label="Menu principal" className="flex h-full flex-col bg-brand text-white">
      <div className="flex items-center gap-3 border-b border-white/15 px-4 py-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-9 w-auto" />
        ) : (
          <ShieldCheck aria-hidden className="h-8 w-8 opacity-90" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{systemName}</p>
          <p className="truncate text-[11px] opacity-75">{institutionName}</p>
        </div>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map(link)}
        {adminNav.length > 0 && (
          <>
            <li className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-white/60">Administração</li>
            {adminNav.map(link)}
          </>
        )}
      </ul>
      <div className="border-t border-white/15 p-3 text-xs">
        <p className="truncate font-semibold">{userName}</p>
        <p className="truncate opacity-75">{roleLabels.join(' · ')}</p>
        <form action={logoutAction} className="mt-2">
          <button type="submit" className="flex items-center gap-2 rounded px-2 py-1 text-white/85 hover:bg-white/10">
            <LogOut aria-hidden className="h-3.5 w-3.5" /> Sair
          </button>
        </form>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a href="#conteudo" className="skip-link">
        Ir para o conteúdo
      </a>
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">{sidebar}</div>
          <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded bg-white p-2" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <button type="button" className="rounded p-1.5 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <p className="truncate text-sm font-semibold text-brand">{systemName}</p>
          <span className="hidden truncate text-xs text-slate-500 sm:inline">— Plataforma de Elaboração e Gestão de Projetos</span>
          {demo && (
            <span className="ml-auto rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900" title="Dados fictícios; não utilize informações reais.">
              MODO DEMONSTRAÇÃO
            </span>
          )}
        </header>
        <main id="conteudo" className="mx-auto max-w-7xl p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
