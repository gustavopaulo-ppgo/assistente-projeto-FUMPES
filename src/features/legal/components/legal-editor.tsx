'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Feedback, useServerAction } from '@/components/action-feedback'
import { Button, Field, inputClass } from '@/components/ui'
import { PROJECT_TYPES } from '@/features/projects/steps'
import { deleteLegalReferenceAction, saveLegalReferenceAction, setLegalValidationAction } from '@/server/actions/admin'
import type { LegalReference, LegalRule, LegalValidationStatus } from '@/types/domain'

const emptyRule = (): LegalRule => ({ project_types: [], provision: '', summary: '', effect: 'permite', required_documents: [], restrictions: [] })

export function LegalEditor({ initial, onDone }: { initial?: LegalReference; onDone?: () => void }) {
  const [f, setF] = useState({
    title: initial?.title ?? '',
    number: initial?.number ?? '',
    date: initial?.date ?? '',
    issuer: initial?.issuer ?? '',
    official_url: initial?.official_url ?? '',
    version: initial?.version ?? '',
    text: initial?.text ?? '',
    categories: (initial?.categories ?? []).join(', '),
  })
  const [rules, setRules] = useState<LegalRule[]>(initial?.rules ?? [])
  const { pending, result, execute } = useServerAction()
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  const setRule = (i: number, patch: Partial<LegalRule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        execute(
          () =>
            saveLegalReferenceAction({
              id: initial?.id ?? null,
              ...f,
              categories: f.categories.split(',').map((c) => c.trim()).filter(Boolean),
              rules,
            }),
          () => onDone?.(),
        )
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Identificação / título" htmlFor="lg-title" required>
          <input id="lg-title" required value={f.title} onChange={(e) => set('title', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Número" htmlFor="lg-number" required>
          <input id="lg-number" required value={f.number} onChange={(e) => set('number', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Data" htmlFor="lg-date">
          <input id="lg-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Órgão emissor" htmlFor="lg-issuer" required>
          <input id="lg-issuer" required value={f.issuer} onChange={(e) => set('issuer', e.target.value)} className={inputClass} />
        </Field>
        <Field label="URL oficial (https)" htmlFor="lg-url" help="Obrigatória para marcar a norma como verificada.">
          <input id="lg-url" type="url" value={f.official_url} onChange={(e) => set('official_url', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Versão / consolidação" htmlFor="lg-version">
          <input id="lg-version" value={f.version} onChange={(e) => set('version', e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Categorias (separadas por vírgula)" htmlFor="lg-cat">
        <input id="lg-cat" value={f.categories} onChange={(e) => set('categories', e.target.value)} className={inputClass} />
      </Field>
      <Field label="Texto (trechos relevantes)" htmlFor="lg-text" help="Transcreva apenas a partir da fonte oficial.">
        <textarea id="lg-text" rows={4} value={f.text} onChange={(e) => set('text', e.target.value)} className={inputClass} />
      </Field>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Regras de enquadramento</p>
        {rules.map((r, i) => (
          <fieldset key={i} className="space-y-2 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs text-slate-600">Regra {i + 1}</legend>
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={r.project_types.includes(t.value)}
                    onChange={(e) => setRule(i, { project_types: e.target.checked ? [...r.project_types, t.value] : r.project_types.filter((x) => x !== t.value) })}
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr_10rem]">
              <select aria-label="Efeito" value={r.effect} onChange={(e) => setRule(i, { effect: e.target.value as LegalRule['effect'] })} className={inputClass}>
                <option value="permite">Permite</option>
                <option value="restringe">Restringe / veda</option>
                <option value="exige_documento">Exige documento</option>
              </select>
              <input aria-label="Resumo da regra" placeholder="Resumo da regra" value={r.summary} onChange={(e) => setRule(i, { summary: e.target.value })} className={inputClass} />
              <input aria-label="Dispositivo" placeholder="Dispositivo (ex.: art. 3º, II)" value={r.provision ?? ''} onChange={(e) => setRule(i, { provision: e.target.value })} className={inputClass} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <textarea aria-label="Documentos exigidos" rows={2} placeholder="Documentos exigidos (um por linha)" value={r.required_documents.join('\n')} onChange={(e) => setRule(i, { required_documents: lines(e.target.value) })} className={inputClass} />
              <textarea aria-label="Restrições" rows={2} placeholder="Restrições (uma por linha)" value={r.restrictions.join('\n')} onChange={(e) => setRule(i, { restrictions: lines(e.target.value) })} className={inputClass} />
            </div>
            <button type="button" className="inline-flex items-center gap-1 text-xs text-red-700" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5" /> Remover regra
            </button>
          </fieldset>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setRules((rs) => [...rs, emptyRule()])}>
          <Plus aria-hidden className="h-4 w-4" /> Adicionar regra
        </Button>
      </div>
      <p className="text-xs text-amber-800">Ao salvar, a norma volta à situação “não verificada” e só será usada nas análises após nova validação.</p>
      <Button type="submit" disabled={pending}>
        Salvar norma
      </Button>
      <Feedback result={result} />
    </form>
  )
}

export function LegalActions({ reference }: { reference: LegalReference }) {
  const [editing, setEditing] = useState(false)
  const { pending, result, execute } = useServerAction()
  const setStatus = (s: LegalValidationStatus) => execute(() => setLegalValidationAction(reference.id, s))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {reference.validation_status !== 'verificada' && (
          <Button size="sm" disabled={pending} onClick={() => confirm('Confirma que conferiu a vigência e o conteúdo desta norma na fonte oficial?') && setStatus('verificada')}>
            Marcar como verificada
          </Button>
        )}
        {reference.validation_status === 'verificada' && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setStatus('desatualizada')}>
            Marcar como desatualizada
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Fechar edição' : 'Editar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => confirm('Remover esta norma da base?') && execute(() => deleteLegalReferenceAction(reference.id))}>
          Remover
        </Button>
      </div>
      <Feedback result={result} />
      {editing && <LegalEditor initial={reference} onDone={() => setEditing(false)} />}
    </div>
  )
}
