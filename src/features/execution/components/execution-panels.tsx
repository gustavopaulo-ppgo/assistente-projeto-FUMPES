'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Feedback, useServerAction } from '@/components/action-feedback'
import { Badge, Button, Field, inputClass } from '@/components/ui'
import { formatBRL, formatDateBR } from '@/features/budget/calc'
import {
  deleteDeliverableAction,
  deleteExpenseAction,
  ensureChecklistAction,
  linkEvidenceAction,
  reviewAccountabilityAction,
  reviewExpenseAction,
  saveDeliverableAction,
  saveExpenseAction,
  updateIndicatorAction,
} from '@/server/actions/execution'
import type { AccountabilityRecord, ProjectDeliverable, ProjectExpense, ProjectIndicator } from '@/types/domain'

type Opt = { id: string; label: string }
const DOC_TONE = { pendente: 'neutral', apresentado: 'info', conferido: 'success', rejeitado: 'danger' } as const

function DocSelect({ id, value, onChange, docs, disabled }: { id: string; value: string; onChange: (v: string) => void; docs: Opt[]; disabled?: boolean }) {
  return (
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">— nenhum —</option>
      {docs.map((d) => (
        <option key={d.id} value={d.id}>
          {d.label}
        </option>
      ))}
    </select>
  )
}

const emptyDeliverable = { id: '', goal: '', description: '', planned_date: '', delivered_date: '', physical_progress: '0', status: 'planejada', document_id: '' }

export function DeliverablesPanel({ projectId, items, docs, canManage }: { projectId: string; items: ProjectDeliverable[]; docs: Opt[]; canManage: boolean }) {
  const [form, setForm] = useState(emptyDeliverable)
  const { pending, result, execute } = useServerAction()
  const set = (k: keyof typeof emptyDeliverable, v: string) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {items.length === 0 && <li className="p-3 text-sm text-slate-500">Nenhuma meta/entrega cadastrada.</li>}
        {items.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{d.goal}</p>
              <p className="text-xs text-slate-500">
                Prevista {formatDateBR(d.planned_date)} · Entregue {formatDateBR(d.delivered_date)} · Avanço físico {d.physical_progress}%
                {d.document_id ? ` · Evidência: ${docs.find((x) => x.id === d.document_id)?.label ?? 'vinculada'}` : ' · sem evidência'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Badge tone={d.status === 'entregue' ? 'success' : d.status === 'cancelada' ? 'neutral' : 'info'}>{d.status}</Badge>
              {canManage && (
                <>
                  <button type="button" aria-label={`Editar ${d.goal}`} className="rounded p-1 hover:bg-slate-100" onClick={() => setForm({ id: d.id, goal: d.goal, description: d.description ?? '', planned_date: d.planned_date ?? '', delivered_date: d.delivered_date ?? '', physical_progress: String(d.physical_progress), status: d.status, document_id: d.document_id ?? '' })}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label={`Excluir ${d.goal}`} className="rounded p-1 text-red-700 hover:bg-red-50" onClick={() => confirm('Excluir esta entrega?') && execute(() => deleteDeliverableAction(projectId, d.id))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canManage && (
        <form
          className="grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            execute(() => saveDeliverableAction(projectId, { ...form, id: form.id || null }), () => setForm(emptyDeliverable))
          }}
        >
          <p className="text-sm font-semibold sm:col-span-2">{form.id ? 'Editar entrega' : 'Nova meta / entrega'}</p>
          <Field label="Meta / entrega" htmlFor="dl-goal" required>
            <input id="dl-goal" required value={form.goal} onChange={(e) => set('goal', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Situação" htmlFor="dl-status">
            <select id="dl-status" value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
              <option value="planejada">Planejada</option>
              <option value="em_andamento">Em andamento</option>
              <option value="entregue">Entregue</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </Field>
          <Field label="Data prevista" htmlFor="dl-planned">
            <input id="dl-planned" type="date" value={form.planned_date} onChange={(e) => set('planned_date', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Data de entrega" htmlFor="dl-delivered">
            <input id="dl-delivered" type="date" value={form.delivered_date} onChange={(e) => set('delivered_date', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Avanço físico (%)" htmlFor="dl-progress">
            <input id="dl-progress" type="number" min={0} max={100} value={form.physical_progress} onChange={(e) => set('physical_progress', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Evidência (documento)" htmlFor="dl-doc">
            <DocSelect id="dl-doc" value={form.document_id} onChange={(v) => set('document_id', v)} docs={docs} />
          </Field>
          <Field label="Descrição" htmlFor="dl-desc">
            <textarea id="dl-desc" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} className={inputClass} />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={pending}>
              Salvar entrega
            </Button>
            {form.id && (
              <Button variant="ghost" onClick={() => setForm(emptyDeliverable)}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      )}
      <Feedback result={result} />
    </div>
  )
}

const emptyExpense = { id: '', budget_item_id: '', description: '', supplier: '', invoice_number: '', issue_date: '', payment_date: '', amount: '', document_id: '' }

export function ExpensesPanel({
  projectId,
  items,
  budgetItems,
  docs,
  canManage,
  canReview,
}: {
  projectId: string
  items: ProjectExpense[]
  budgetItems: Opt[]
  docs: Opt[]
  canManage: boolean
  canReview: boolean
}) {
  const [form, setForm] = useState(emptyExpense)
  const { pending, result, execute } = useServerAction()
  const set = (k: keyof typeof emptyExpense, v: string) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div className="space-y-4">
      <div className="relative overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th className="px-2 py-2">Descrição</th>
              <th className="px-2 py-2">Item do orçamento</th>
              <th className="px-2 py-2">NF / comprovante</th>
              <th className="px-2 py-2">Emissão</th>
              <th className="px-2 py-2 text-right">Valor</th>
              <th className="px-2 py-2">Situação</th>
              <th className="px-2 py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-3 text-slate-500">
                  Nenhuma despesa lançada.
                </td>
              </tr>
            )}
            {items.map((x) => (
              <tr key={x.id} className="align-top">
                <td className="px-2 py-2">
                  {x.description}
                  <p className="text-xs text-slate-500">{x.supplier}</p>
                </td>
                <td className="px-2 py-2 text-xs">{budgetItems.find((b) => b.id === x.budget_item_id)?.label ?? '—'}</td>
                <td className="px-2 py-2 text-xs">
                  {x.invoice_number ?? '—'}
                  <p>{x.document_id ? `📎 ${docs.find((d) => d.id === x.document_id)?.label ?? ''}` : 'sem documento'}</p>
                </td>
                <td className="px-2 py-2 text-xs">{formatDateBR(x.issue_date)}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right">R$ {formatBRL(x.amount)}</td>
                <td className="px-2 py-2">
                  <Badge tone={x.status === 'conferida' ? 'success' : x.status === 'rejeitada' ? 'danger' : 'info'}>{x.status}</Badge>
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  {canReview && x.status === 'lancada' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => execute(() => reviewExpenseAction(projectId, x.id, 'conferida'))}>
                        Conferir
                      </Button>{' '}
                      <Button size="sm" variant="secondary" onClick={() => execute(() => reviewExpenseAction(projectId, x.id, 'rejeitada', prompt('Motivo:') ?? undefined))}>
                        Rejeitar
                      </Button>
                    </>
                  )}
                  {canManage && x.status !== 'conferida' && (
                    <>
                      <button type="button" aria-label="Editar despesa" className="rounded p-1 hover:bg-slate-100" onClick={() => setForm({ id: x.id, budget_item_id: x.budget_item_id ?? '', description: x.description, supplier: x.supplier ?? '', invoice_number: x.invoice_number ?? '', issue_date: x.issue_date ?? '', payment_date: x.payment_date ?? '', amount: x.amount, document_id: x.document_id ?? '' })}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Excluir despesa" className="rounded p-1 text-red-700 hover:bg-red-50" onClick={() => confirm('Excluir esta despesa?') && execute(() => deleteExpenseAction(projectId, x.id))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage && (
        <form
          className="grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            execute(() => saveExpenseAction(projectId, { ...form, id: form.id || null }), () => setForm(emptyExpense))
          }}
        >
          <p className="text-sm font-semibold sm:col-span-3">{form.id ? 'Editar despesa' : 'Lançar despesa'}</p>
          <Field label="Descrição" htmlFor="ex-desc" required>
            <input id="ex-desc" required value={form.description} onChange={(e) => set('description', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Item do orçamento" htmlFor="ex-item">
            <select id="ex-item" value={form.budget_item_id} onChange={(e) => set('budget_item_id', e.target.value)} className={inputClass}>
              <option value="">— não vinculado —</option>
              {budgetItems.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valor (R$)" htmlFor="ex-amount" required>
            <input id="ex-amount" required inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Fornecedor" htmlFor="ex-sup">
            <input id="ex-sup" value={form.supplier} onChange={(e) => set('supplier', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Nº nota fiscal / comprovante" htmlFor="ex-nf">
            <input id="ex-nf" value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Documento comprobatório" htmlFor="ex-doc">
            <DocSelect id="ex-doc" value={form.document_id} onChange={(v) => set('document_id', v)} docs={docs} />
          </Field>
          <Field label="Data de emissão" htmlFor="ex-issue">
            <input id="ex-issue" type="date" value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Data de pagamento" htmlFor="ex-pay">
            <input id="ex-pay" type="date" value={form.payment_date} onChange={(e) => set('payment_date', e.target.value)} className={inputClass} />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={pending}>
              Salvar despesa
            </Button>
            {form.id && (
              <Button variant="ghost" onClick={() => setForm(emptyExpense)}>
                Cancelar
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500 sm:col-span-3">Registro de controle interno. O sistema não realiza pagamentos nem movimentações financeiras.</p>
        </form>
      )}
      <Feedback result={result} />
    </div>
  )
}

export function IndicatorsPanel({ projectId, items, canManage }: { projectId: string; items: ProjectIndicator[]; canManage: boolean }) {
  const [values, setValues] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.current_value ?? ''])))
  const { result, execute } = useServerAction()
  if (!items.length) return <p className="text-sm text-slate-500">Nenhum indicador definido na elaboração.</p>
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.id} className="grid items-end gap-2 text-sm sm:grid-cols-[1fr_8rem_8rem_10rem_auto]">
          <span>
            <strong>{i.name}</strong>
            <span className="block text-xs text-slate-500">{i.formula}</span>
          </span>
          <span className="text-xs">Base: {i.baseline ?? '—'}</span>
          <span className="text-xs">Meta: {i.target ?? '—'}</span>
          <label className="text-xs">
            Valor atual
            <input disabled={!canManage} value={values[i.id]} onChange={(e) => setValues((v) => ({ ...v, [i.id]: e.target.value }))} className={inputClass} />
          </label>
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => execute(() => updateIndicatorAction(projectId, i.id, values[i.id]))}>
              Atualizar
            </Button>
          )}
        </div>
      ))}
      <Feedback result={result} />
    </div>
  )
}

export function AccountabilityPanel({
  projectId,
  records,
  docs,
  canManage,
  canReview,
}: {
  projectId: string
  records: AccountabilityRecord[]
  docs: Opt[]
  canManage: boolean
  canReview: boolean
}) {
  const { pending, result, execute } = useServerAction()
  if (!records.length) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-500">O checklist de prestação de contas ainda não foi iniciado.</p>
        {canManage && (
          <Button onClick={() => execute(() => ensureChecklistAction(projectId))} disabled={pending}>
            Iniciar checklist de prestação de contas
          </Button>
        )}
        <Feedback result={result} />
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {records.map((r) => (
          <li key={r.id} className="grid items-center gap-2 p-3 text-sm md:grid-cols-[1fr_14rem_auto]">
            <div>
              <p className="font-medium">{r.item}</p>
              {r.note && <p className="text-xs text-slate-600">Obs.: {r.note}</p>}
            </div>
            <DocSelect id={`acc-${r.id}`} value={r.document_id ?? ''} docs={docs} disabled={!canManage || r.status === 'conferido'} onChange={(v) => execute(() => linkEvidenceAction(projectId, r.id, v || null))} />
            <div className="flex items-center gap-1">
              <Badge tone={DOC_TONE[r.status]}>{r.status}</Badge>
              {canReview && r.status === 'apresentado' && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => execute(() => reviewAccountabilityAction(projectId, r.id, 'conferido'))}>
                    Conferir
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { const n = prompt('Motivo da rejeição:'); if (n) execute(() => reviewAccountabilityAction(projectId, r.id, 'rejeitado', n)) }}>
                    Rejeitar
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        A conferência de itens é feita pelo gestor financeiro. O sistema não declara a prestação de contas aprovada: o encerramento exige ato de usuário autorizado com referência ao processo administrativo.
      </p>
      <Feedback result={result} />
    </div>
  )
}
