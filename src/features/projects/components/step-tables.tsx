'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Alert, Badge, inputClass } from '@/components/ui'
import { formatBRL, itemTotal, parseDecimal, referencePrice, sumDecimals, summarizeBudget, type BudgetInput } from '@/features/budget/calc'
import { BUDGET_CATEGORIES } from '@/features/projects/steps'
import type { PriceEstimate } from '@/types/domain'
import { TableEditor, type Row } from './table-editor'

export function ObjectivesTables({ objectives, indicators }: { objectives: Row[]; indicators: Row[] }) {
  return (
    <div className="space-y-6">
      <TableEditor
        entity="objectives"
        title="Objetivos específicos"
        emptyText="Nenhum objetivo específico. Pense em ações concretas que levam ao objetivo geral."
        columns={[
          { key: 'description', label: 'Objetivo específico', type: 'textarea', width: '18rem', required: true },
          { key: 'expected_result', label: 'Resultado esperado', type: 'textarea', width: '14rem' },
        ]}
        initialRows={objectives}
        newRow={() => ({ description: '', expected_result: '' })}
      />
      <TableEditor
        entity="indicators"
        title="Indicadores de desempenho"
        emptyText="Nenhum indicador. Um indicador mede algo antes e depois do projeto (linha de base → meta)."
        columns={[
          { key: 'name', label: 'Indicador', type: 'text', width: '12rem', required: true },
          { key: 'formula', label: 'Fórmula de cálculo', type: 'text', width: '10rem' },
          { key: 'baseline', label: 'Linha de base', type: 'text', width: '7rem', placeholder: 'a levantar' },
          { key: 'target', label: 'Meta', type: 'text', width: '7rem' },
          { key: 'unit', label: 'Unidade', type: 'text', width: '6rem' },
          { key: 'frequency', label: 'Periodicidade', type: 'text', width: '7rem' },
          { key: 'source', label: 'Fonte de verificação', type: 'text', width: '10rem' },
        ]}
        initialRows={indicators}
        newRow={() => ({ name: '', formula: '', baseline: '', target: '', unit: '', frequency: '', source: '' })}
      />
    </div>
  )
}

export function ScheduleTable({ rows }: { rows: Row[] }) {
  return (
    <TableEditor
      entity="schedule"
      title="Atividades"
      emptyText="Nenhuma atividade. Liste as etapas até a entrega final."
      columns={[
        { key: 'activity', label: 'Atividade', type: 'textarea', width: '14rem', required: true },
        { key: 'responsible', label: 'Responsável', type: 'text', width: '9rem' },
        { key: 'start_date', label: 'Início', type: 'date', width: '9rem' },
        { key: 'end_date', label: 'Término', type: 'date', width: '9rem' },
        { key: 'is_milestone', label: 'Marco', type: 'checkbox' },
        { key: 'depends_on', label: 'Depende de', type: 'rowref', width: '9rem' },
        { key: 'planned_amount', label: 'Desembolso (R$)', type: 'decimal', width: '8rem' },
      ]}
      initialRows={rows}
      newRow={() => ({ activity: '', responsible: '', start_date: '', end_date: '', is_milestone: false, depends_on: null, planned_amount: '0' })}
      footer={(rs) => (
        <p className="text-sm text-slate-600">
          Desembolso total previsto: <strong>R$ {formatBRL(sumDecimals(rs.map((r) => parseDecimal(String(r.planned_amount ?? '0'))?.toString() ?? '0')))}</strong>
        </p>
      )}
    />
  )
}

const RISK_LEVEL = (p: number, i: number) => {
  const n = p * i
  return n >= 15 ? { tone: 'danger' as const, label: `Alto (${n})` } : n >= 8 ? { tone: 'warning' as const, label: `Médio (${n})` } : { tone: 'success' as const, label: `Baixo (${n})` }
}

export function RisksTable({ rows }: { rows: Row[] }) {
  const scale = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))
  return (
    <TableEditor
      entity="risks"
      title="Matriz de riscos"
      emptyText="Nenhum risco identificado. O que pode atrasar ou impedir o projeto?"
      columns={[
        {
          key: 'category',
          label: 'Categoria',
          type: 'select',
          required: true,
          width: '8rem',
          options: [
            { value: 'tecnico', label: 'Técnico' },
            { value: 'financeiro', label: 'Financeiro' },
            { value: 'administrativo', label: 'Administrativo' },
            { value: 'outro', label: 'Outro' },
          ],
        },
        { key: 'description', label: 'Descrição do risco', type: 'textarea', width: '14rem', required: true },
        { key: 'probability', label: 'Probabilidade (1–5)', type: 'select', options: scale, required: true },
        { key: 'impact', label: 'Impacto (1–5)', type: 'select', options: scale, required: true },
        { key: 'mitigation', label: 'Medida de mitigação', type: 'textarea', width: '14rem' },
        { key: 'owner', label: 'Responsável', type: 'text', width: '8rem' },
      ]}
      computed={{
        label: 'Nível',
        render: (r) => {
          const l = RISK_LEVEL(Number(r.probability) || 1, Number(r.impact) || 1)
          return <Badge tone={l.tone}>{l.label}</Badge>
        },
      }}
      initialRows={rows.map((r) => ({ ...r, probability: String(r.probability), impact: String(r.impact) }))}
      newRow={() => ({ category: 'tecnico', description: '', probability: '3', impact: '3', mitigation: '', owner: '' })}
    />
  )
}

function EstimatesEditor({ row, update, disabled }: { row: Row; update: (p: Record<string, unknown>) => void; disabled: boolean }) {
  const estimates = (row.estimates as PriceEstimate[]) ?? []
  const set = (list: PriceEstimate[]) => update({ estimates: list })
  const median = referencePrice(estimates, 'mediana')
  return (
    <details className="rounded-md bg-slate-50 p-2 text-xs">
      <summary className="cursor-pointer select-none text-slate-700">
        Estimativas de preço ({estimates.length}){median && ` — mediana R$ ${formatBRL(median)}`} · justificativa e documento
      </summary>
      <div className="mt-2 space-y-2">
        {estimates.map((e, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_9rem_auto]">
            <input aria-label={`Fonte da estimativa ${i + 1}`} disabled={disabled} className={inputClass} placeholder="Fonte (fornecedor, painel de preços…)" value={e.source} onChange={(ev) => set(estimates.map((x, j) => (j === i ? { ...x, source: ev.target.value } : x)))} />
            <input aria-label={`Preço da estimativa ${i + 1}`} disabled={disabled} className={inputClass} inputMode="decimal" placeholder="Preço unit." value={e.unit_price} onChange={(ev) => set(estimates.map((x, j) => (j === i ? { ...x, unit_price: ev.target.value } : x)))} />
            <input aria-label={`Data da estimativa ${i + 1}`} disabled={disabled} type="date" className={inputClass} value={e.reference_date ?? ''} onChange={(ev) => set(estimates.map((x, j) => (j === i ? { ...x, reference_date: ev.target.value } : x)))} />
            {!disabled && (
              <button type="button" aria-label={`Remover estimativa ${i + 1}`} className="rounded p-1 text-red-700 hover:bg-red-50" onClick={() => set(estimates.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex items-center gap-1 text-brand" onClick={() => set([...estimates, { source: '', unit_price: '', reference_date: null }])} disabled={estimates.length >= 10}>
              <Plus className="h-3.5 w-3.5" /> Adicionar estimativa
            </button>
            {median && (
              <button type="button" className="text-brand underline" onClick={() => update({ unit_price: median.replace('.', ',') })}>
                Usar a mediana como preço unitário
              </button>
            )}
          </div>
        )}
        <label className="block">
          <span className="text-slate-600">Justificativa (escolha do preço, divergências)</span>
          <textarea disabled={disabled} rows={2} className={inputClass} value={(row.justification as string) ?? ''} onChange={(e) => update({ justification: e.target.value })} />
        </label>
      </div>
    </details>
  )
}

export function BudgetTable({ rows, documents }: { rows: Row[]; documents: { id: string; name: string }[] }) {
  return (
    <div className="space-y-3">
      <Alert tone="warning">
        Informe apenas valores de pesquisas de preço reais, com fonte e data. O sistema e o assistente de IA não fornecem preços de mercado. A natureza de despesa é uma sugestão
        sujeita à validação da área orçamentária.
      </Alert>
      <TableEditor
        entity="budget"
        title="Itens do orçamento"
        emptyText="Nenhum item. Adicione os bens ou serviços necessários."
        columns={[
          { key: 'description', label: 'Descrição', type: 'textarea', width: '14rem', required: true },
          { key: 'category', label: 'Categoria', type: 'select', width: '10rem', options: BUDGET_CATEGORIES.map((c) => ({ value: c, label: c })) },
          { key: 'unit', label: 'Unidade', type: 'text', width: '5rem', required: true },
          { key: 'quantity', label: 'Qtd.', type: 'decimal', width: '5rem', required: true, placeholder: '0' },
          { key: 'unit_price', label: 'Preço unit. (R$)', type: 'decimal', width: '7rem', required: true },
          { key: 'source', label: 'Fonte da pesquisa', type: 'text', width: '10rem', required: true },
          { key: 'reference_date', label: 'Data ref.', type: 'date', width: '9rem', required: true },
          { key: 'expense_nature', label: 'Natureza (sugerida)', type: 'text', width: '7rem', placeholder: 'ex.: 4.4.90.52' },
          { key: 'document_id', label: 'Comprovante', type: 'select', width: '9rem', options: documents.map((d) => ({ value: d.id, label: d.name })) },
        ]}
        computed={{ label: 'Total (R$)', render: (r) => formatBRL(itemTotal(String(r.quantity ?? ''), String(r.unit_price ?? ''))) }}
        extra={(row, update, disabled) => <EstimatesEditor row={row} update={update} disabled={disabled} />}
        initialRows={rows}
        newRow={() => ({ description: '', category: '', unit: 'unidade', quantity: '1', unit_price: '', source: '', reference_date: '', expense_nature: '', document_id: '', justification: '', estimates: [] })}
        footer={(rs) => <BudgetSummary rows={rs} />}
      />
    </div>
  )
}

function BudgetSummary({ rows }: { rows: Row[] }) {
  const s = summarizeBudget(rows as unknown as BudgetInput[])
  const errors = s.issues.filter((i) => i.severity === 'erro')
  const alerts = s.issues.filter((i) => i.severity === 'alerta')
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-md border border-slate-200 p-3 text-sm">
        <p className="font-semibold">Total geral: R$ {formatBRL(s.total)}</p>
        <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
          {s.byCategory.map((c) => (
            <li key={c.category} className="flex justify-between">
              <span>
                {c.category} ({c.count})
              </span>
              <span>R$ {formatBRL(c.subtotal)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">Cálculos com aritmética decimal exata; o total é recalculado no servidor ao salvar.</p>
      </div>
      <div className="space-y-1 text-xs">
        {errors.length === 0 && alerts.length === 0 && rows.length > 0 && <p className="text-emerald-700">Nenhuma inconsistência encontrada.</p>}
        {errors.slice(0, 8).map((i, k) => (
          <p key={`e${k}`} className="text-red-700">
            Item {i.itemIndex + 1}: {i.message}
          </p>
        ))}
        {alerts.slice(0, 8).map((i, k) => (
          <p key={`a${k}`} className="text-amber-800">
            Item {i.itemIndex + 1}: {i.message}
          </p>
        ))}
      </div>
    </div>
  )
}
