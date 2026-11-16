'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle2, CircleDashed, UserRound } from 'lucide-react'
import { Feedback, type Result } from '@/components/action-feedback'
import { Badge, Field, inputClass } from '@/components/ui'
import type { FieldDef } from '@/features/projects/steps'
import { saveStepAction } from '@/server/actions/projects'
import type { FieldMeta } from '@/types/domain'
import { useWizard, type SaveOptions } from './wizard-context'

function OriginBadge({ meta, value, required, aiPending }: { meta?: FieldMeta; value: string; required: boolean; aiPending: boolean }) {
  if (aiPending) {
    return (
      <Badge tone="warning">
        <Bot aria-hidden className="h-3 w-3" /> Sugestão da IA — salve para confirmar
      </Badge>
    )
  }
  if (!value.trim()) {
    return required ? (
      <Badge tone="danger">
        <CircleDashed aria-hidden className="h-3 w-3" /> Pendente
      </Badge>
    ) : (
      <Badge>Opcional</Badge>
    )
  }
  if (meta?.origin === 'ia_aceita') {
    return (
      <Badge tone="info">
        <Bot aria-hidden className="h-3 w-3" /> Sugestão da IA aceita pelo servidor
      </Badge>
    )
  }
  return (
    <Badge tone="success">
      <UserRound aria-hidden className="h-3 w-3" /> Informado pelo servidor
    </Badge>
  )
}

export function StepFieldsForm({ fields, initial, meta }: { fields: FieldDef[]; initial: Record<string, string>; meta: Record<string, FieldMeta> }) {
  const { projectId, step, canEdit, setDirty, registerSaver, registerInserter } = useWizard()
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? ''])))
  const [saved, setSaved] = useState(values)
  const [aiFields, setAiFields] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<Result | null>(null)
  const latest = useRef({ values, aiFields, saved })
  useEffect(() => {
    latest.current = { values, aiFields, saved }
  })

  const isDirty = fields.some((f) => values[f.key] !== saved[f.key])
  useEffect(() => setDirty('fields', isDirty), [isDirty, setDirty])

  useEffect(() => {
    if (!canEdit) return
    const save = async (opts: SaveOptions) => {
      const { values: v, aiFields: ai, saved: s } = latest.current
      const changed = fields.some((f) => v[f.key] !== s[f.key])
      if (!changed && !opts.nextStep) return true
      const r = await saveStepAction(projectId, step, { values: v, aiAcceptedFields: [...ai], nextStep: opts.nextStep })
      setResult(r)
      if (r.ok) {
        setSaved(v)
        setAiFields(new Set())
      }
      return r.ok
    }
    registerSaver('fields', save)
    registerInserter((field, text) => {
      if (!fields.some((f) => f.key === field)) return
      setValues((prev) => ({ ...prev, [field]: text }))
      setAiFields((prev) => new Set(prev).add(field))
      document.getElementById(`f-${field}`)?.focus()
    })
    return () => {
      registerSaver('fields', null)
      registerInserter(null)
    }
  }, [canEdit, fields, projectId, step, registerSaver, registerInserter])

  const update = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }))
    // editar manualmente o texto da IA torna o conteúdo do servidor
    if (aiFields.has(key)) setAiFields((prev) => {
      const n = new Set(prev)
      n.delete(key)
      return n
    })
  }

  return (
    <div className="space-y-5">
      {fields.map((f) => {
        const id = `f-${f.key}`
        const common = { id, name: f.key, value: values[f.key], disabled: !canEdit, maxLength: f.maxLength, className: inputClass, 'aria-describedby': `${id}-q` }
        return (
          <div key={f.key} className="rounded-md border border-slate-100 p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span id={`${id}-q`} className="text-sm text-slate-700">
                {f.question}
              </span>
              <OriginBadge meta={meta[f.key]} value={values[f.key]} required={f.required} aiPending={aiFields.has(f.key)} />
            </div>
            <Field label={f.label} htmlFor={id} help={f.help} required={f.required}>
              {f.type === 'select' ? (
                <select {...common} onChange={(e) => update(f.key, e.target.value)}>
                  <option value="">Selecione…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'text' ? (
                <input {...common} onChange={(e) => update(f.key, e.target.value)} />
              ) : (
                <textarea {...common} rows={4} onChange={(e) => update(f.key, e.target.value)} />
              )}
            </Field>
            {f.type === 'textarea' && (
              <p className="mt-1 text-right text-[11px] text-slate-400">
                {values[f.key].length}/{f.maxLength}
              </p>
            )}
          </div>
        )
      })}
      {result && !result.ok && <Feedback result={result} />}
      {result?.ok && !isDirty && (
        <p className="flex items-center gap-1 text-xs text-emerald-700" role="status">
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> Alterações salvas.
        </p>
      )}
    </div>
  )
}
