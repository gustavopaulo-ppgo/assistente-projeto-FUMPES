'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Save } from 'lucide-react'
import { Button, cn } from '@/components/ui'
import { useWizard } from './wizard-context'

interface StepInfo {
  number: number
  title: string
  percent: number
}

/** Lista de etapas: salva automaticamente antes de mudar de etapa. */
export function Stepper({ steps }: { steps: StepInfo[] }) {
  const { projectId, step, saveAll, canEdit } = useWizard()
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (n: number) =>
    start(async () => {
      if (canEdit && !(await saveAll({ nextStep: n }))) return
      router.push(`/projetos/${projectId}/elaborar/${n}`)
    })
  return (
    <nav aria-label="Etapas do projeto">
      <ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {steps.map((s) => {
          const current = s.number === step
          return (
            <li key={s.number}>
              <button
                type="button"
                disabled={pending}
                onClick={() => go(s.number)}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-sm',
                  current ? 'bg-brand text-white' : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                {s.percent === 100 ? <CheckCircle2 aria-hidden className={cn('h-4 w-4 shrink-0', current ? 'text-white' : 'text-emerald-600')} /> : <Circle aria-hidden className="h-4 w-4 shrink-0 opacity-60" />}
                <span>
                  {s.number}. {s.title}
                </span>
                <span className={cn('ml-auto text-[11px]', current ? 'text-white/80' : 'text-slate-400')}>{s.percent}%</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function StepFooter({ total }: { total: number }) {
  const { projectId, step, saveAll, canEdit, dirty } = useWizard()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)
  const go = (n: number) =>
    start(async () => {
      if (canEdit && !(await saveAll({ nextStep: n }))) return
      router.push(n === 0 ? `/projetos/${projectId}` : `/projetos/${projectId}/elaborar/${n}`)
    })
  return (
    <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
      <Button variant="secondary" disabled={pending || step === 1} onClick={() => go(step - 1)}>
        <ChevronLeft aria-hidden className="h-4 w-4" /> Etapa anterior
      </Button>
      <div className="flex items-center gap-2">
        {canEdit && (
          <>
            <span className="text-xs text-slate-500" role="status">
              {dirty ? 'Alterações não salvas' : saved ? 'Tudo salvo' : ''}
            </span>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const ok = await saveAll({ nextStep: step })
                  setSaved(ok)
                  if (ok) router.refresh()
                })
              }
            >
              <Save aria-hidden className="h-4 w-4" /> Salvar
            </Button>
          </>
        )}
        {step < total ? (
          <Button disabled={pending} onClick={() => go(step + 1)}>
            {canEdit ? 'Salvar e avançar' : 'Próxima etapa'} <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={pending} onClick={() => go(0)}>
            {canEdit ? 'Salvar e ir para a tramitação' : 'Visão geral'}
          </Button>
        )}
      </div>
    </div>
  )
}
