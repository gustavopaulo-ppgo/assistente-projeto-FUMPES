'use client'

import { useState } from 'react'
import { Feedback, useServerAction } from '@/components/action-feedback'
import { Button, Field, inputClass } from '@/components/ui'
import { transitionAction } from '@/server/actions/projects'
import type { ProjectStatus } from '@/types/domain'

export interface TransitionOption {
  to: ProjectStatus
  label: string
  requireNote: boolean
  requireAdministrativeReference: boolean
  requireComplete: boolean
}

export function TransitionPanel({ projectId, options }: { projectId: string; options: TransitionOption[] }) {
  const [selected, setSelected] = useState<TransitionOption | null>(options.length === 1 ? options[0] : null)
  const [note, setNote] = useState('')
  const [ref, setRef] = useState('')
  const { pending, result, execute } = useServerAction()

  if (!options.length) return <p className="text-sm text-slate-500">Nenhuma ação de tramitação disponível para o seu perfil nesta situação.</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ações disponíveis">
        {options.map((o) => (
          <Button key={o.to} variant={selected?.to === o.to ? 'primary' : 'secondary'} size="sm" role="radio" aria-checked={selected?.to === o.to} onClick={() => setSelected(o)}>
            {o.label}
          </Button>
        ))}
      </div>
      {selected && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            execute(() => transitionAction(projectId, { to: selected.to, note, administrative_reference: ref }), () => {
              setNote('')
              setRef('')
            })
          }}
        >
          {selected.requireComplete && <p className="text-xs text-slate-600">Esta ação exige que não haja pendências obrigatórias no projeto.</p>}
          <Field label="Observação / justificativa" htmlFor="tr-note" required={selected.requireNote}>
            <textarea id="tr-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} className={inputClass} />
          </Field>
          {selected.requireAdministrativeReference && (
            <Field
              label="Referência do ato/processo administrativo"
              htmlFor="tr-ref"
              required
              help="Ex.: número do processo SEI e do despacho. O sistema registra a decisão humana já formalizada; ele não a substitui."
            >
              <input id="tr-ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={300} className={inputClass} />
            </Field>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? 'Registrando…' : `Confirmar: ${selected.label}`}
          </Button>
        </form>
      )}
      <Feedback result={result} />
    </div>
  )
}
