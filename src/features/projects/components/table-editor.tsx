'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Feedback, type Result } from '@/components/action-feedback'
import { Button, inputClass } from '@/components/ui'
import { saveTableAction } from '@/server/actions/projects'
import type { TableEntity } from '@/server/validation/schemas'
import { useWizard } from './wizard-context'

export type Row = Record<string, unknown> & { id: string }

export interface Column {
  key: string
  label: string
  type: 'text' | 'textarea' | 'decimal' | 'int' | 'date' | 'select' | 'checkbox' | 'rowref'
  options?: { value: string; label: string }[]
  width?: string
  required?: boolean
  placeholder?: string
}

const tempId = () => crypto.randomUUID()

export function TableEditor({
  entity,
  title,
  columns,
  initialRows,
  newRow,
  computed,
  extra,
  footer,
  emptyText,
}: {
  entity: TableEntity
  title?: string
  columns: Column[]
  initialRows: Row[]
  newRow: () => Record<string, unknown>
  computed?: { label: string; render: (row: Row) => ReactNode }
  extra?: (row: Row, update: (patch: Record<string, unknown>) => void, disabled: boolean) => ReactNode
  footer?: (rows: Row[]) => ReactNode
  emptyText: string
}) {
  const { projectId, canEdit, setDirty, registerSaver } = useWizard()
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialRows))
  const [result, setResult] = useState<Result | null>(null)
  const latest = useRef({ rows, savedJson })
  useEffect(() => {
    latest.current = { rows, savedJson }
  })
  const dirty = JSON.stringify(rows) !== savedJson
  const key = `table-${entity}`
  useEffect(() => setDirty(key, dirty), [dirty, key, setDirty])

  useEffect(() => {
    if (!canEdit) return
    registerSaver(key, async () => {
      const { rows: current, savedJson: lastSaved } = latest.current
      if (JSON.stringify(current) === lastSaved) return true
      const r = await saveTableAction(projectId, entity, current)
      setResult(r)
      if (r.ok) setSavedJson(JSON.stringify(current))
      return r.ok
    })
    return () => registerSaver(key, null)
  }, [canEdit, entity, key, projectId, registerSaver])

  const update = (id: string, patch: Record<string, unknown>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const j = i + d
      if (j < 0 || j >= rs.length) return rs
      const copy = [...rs]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })

  const cell = (row: Row, c: Column, idx: number) => {
    const id = `${entity}-${idx}-${c.key}`
    const v = row[c.key]
    const label = `${c.label} (linha ${idx + 1})`
    const common = { id, 'aria-label': label, disabled: !canEdit, className: `${inputClass} min-w-0` }
    switch (c.type) {
      case 'textarea':
        return <textarea {...common} rows={2} value={(v as string) ?? ''} onChange={(e) => update(row.id, { [c.key]: e.target.value })} />
      case 'select':
        return (
          <select {...common} value={(v as string) ?? ''} onChange={(e) => update(row.id, { [c.key]: e.target.value })}>
            {!c.required && <option value="">—</option>}
            {c.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )
      case 'rowref':
        return (
          <select {...common} value={(v as string) ?? ''} onChange={(e) => update(row.id, { [c.key]: e.target.value || null })}>
            <option value="">—</option>
            {rows
              .filter((r) => r.id !== row.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {String(r.activity ?? r.description ?? r.id).slice(0, 40)}
                </option>
              ))}
          </select>
        )
      case 'checkbox':
        return <input type="checkbox" id={id} aria-label={label} disabled={!canEdit} checked={Boolean(v)} onChange={(e) => update(row.id, { [c.key]: e.target.checked })} className="h-4 w-4" />
      case 'date':
        return <input {...common} type="date" value={(v as string) ?? ''} onChange={(e) => update(row.id, { [c.key]: e.target.value })} />
      case 'int':
        return <input {...common} type="number" min={1} max={5} value={String(v ?? '')} onChange={(e) => update(row.id, { [c.key]: e.target.value })} />
      case 'decimal':
        return <input {...common} inputMode="decimal" placeholder={c.placeholder ?? '0,00'} value={String(v ?? '')} onChange={(e) => update(row.id, { [c.key]: e.target.value })} />
      default:
        return <input {...common} placeholder={c.placeholder} value={(v as string) ?? ''} onChange={(e) => update(row.id, { [c.key]: e.target.value })} />
    }
  }

  return (
    <div className="space-y-3">
      {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="relative overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-2 py-2">#</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-2 py-2 font-semibold" style={{ minWidth: c.width }}>
                    {c.label}
                    {c.required && <span className="text-red-700"> *</span>}
                  </th>
                ))}
                {computed && <th className="px-2 py-2 text-right">{computed.label}</th>}
                {canEdit && <th className="px-2 py-2">
                  <span className="sr-only">Ações</span>
                </th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <FragmentRow key={row.id}>
                  <tr className="align-top">
                    <td className="px-2 py-2 text-xs text-slate-500">{idx + 1}</td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-1 py-1.5">
                        {cell(row, c, idx)}
                      </td>
                    ))}
                    {computed && <td className="whitespace-nowrap px-2 py-2 text-right font-medium">{computed.render(row)}</td>}
                    {canEdit && (
                      <td className="whitespace-nowrap px-1 py-1.5">
                        <button type="button" className="rounded p-1 hover:bg-slate-100" aria-label={`Mover linha ${idx + 1} para cima`} onClick={() => move(idx, -1)}>
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded p-1 hover:bg-slate-100" aria-label={`Mover linha ${idx + 1} para baixo`} onClick={() => move(idx, 1)}>
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-red-700 hover:bg-red-50"
                          aria-label={`Excluir linha ${idx + 1}`}
                          onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id).map((r) => (r.depends_on === row.id ? { ...r, depends_on: null } : r)))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                  {extra && (
                    <tr>
                      <td />
                      <td colSpan={columns.length + (computed ? 1 : 0) + (canEdit ? 1 : 0)} className="px-1 pb-3">
                        {extra(row, (patch) => update(row.id, patch), !canEdit)}
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, { id: tempId(), ...newRow() } as Row])} disabled={rows.length >= 300}>
            <Plus aria-hidden className="h-4 w-4" /> Adicionar linha
          </Button>
          {dirty && <span className="text-xs text-amber-700">Alterações não salvas</span>}
        </div>
      )}
      {footer?.(rows)}
      <Feedback result={result && !result.ok ? result : null} />
    </div>
  )
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>
}
