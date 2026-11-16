import { StatusBadge } from '@/components/status-badge'
import { ProgressBar } from '@/components/ui'
import { ProjectTabs } from '@/features/projects/components/project-tabs'
import { EXECUTION_STATUSES } from '@/features/workflow/config'
import { loadProjectPage } from '@/server/pages'

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  const { bundle } = await loadProjectPage(id)
  const p = bundle.project
  const hasExecution = EXECUTION_STATUSES.has(p.status) || p.status === 'encerrado'
  return (
    <div>
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-500">
              {p.code} · {bundle.unit?.acronym} · versão {p.version}
            </p>
            <h1 className="mt-1 text-lg font-bold text-ink sm:text-xl">{p.title}</h1>
          </div>
          <StatusBadge status={p.status} />
        </div>
        <div className="mt-3 max-w-md">
          <ProgressBar value={p.completion} label="Preenchimento do projeto" />
        </div>
        <ProjectTabs projectId={p.id} hasExecution={hasExecution} />
      </div>
      {children}
    </div>
  )
}
