import Decimal from 'decimal.js'
import type { PriceEstimate, ProjectBudgetItem } from '@/types/domain'

/**
 * Cálculos orçamentários com aritmética decimal exata.
 * Regra de arredondamento: meio para cima (ROUND_HALF_UP), 2 casas para valores.
 */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export type BudgetInput = Pick<
  ProjectBudgetItem,
  'description' | 'category' | 'unit' | 'quantity' | 'unit_price' | 'source' | 'reference_date' | 'expense_nature'
> & { total?: string; estimates?: PriceEstimate[]; id?: string; document_id?: string | null }

/** Converte string em Decimal aceitando vírgula decimal brasileira. Retorna null se inválido. */
export function parseDecimal(value: string | number | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null
  let s = String(value).trim()
  if (s === '') return null
  s = s.replace(/\s|R\$/g, '')
  // "1.234,56" -> "1234.56"; "1234,56" -> "1234.56"
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  try {
    return new Decimal(s)
  } catch {
    return null
  }
}

export function money(value: Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
}

export function itemTotal(quantity: string, unitPrice: string): string {
  const q = parseDecimal(quantity)
  const p = parseDecimal(unitPrice)
  if (!q || !p) return '0.00'
  return money(q.mul(p))
}

export type EstimateCriterion = 'media' | 'mediana' | 'menor'

/** Preço de referência a partir de múltiplas estimativas. */
export function referencePrice(estimates: PriceEstimate[], criterion: EstimateCriterion = 'mediana'): string | null {
  const values = estimates.map((e) => parseDecimal(e.unit_price)).filter((v): v is Decimal => v !== null && v.gt(0))
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a.comparedTo(b))
  if (criterion === 'menor') return money(sorted[0])
  if (criterion === 'media') return money(Decimal.sum(...sorted).div(sorted.length))
  const mid = Math.floor(sorted.length / 2)
  return money(sorted.length % 2 ? sorted[mid] : sorted[mid - 1].add(sorted[mid]).div(2))
}

export interface ItemIssue {
  itemIndex: number
  field: string
  message: string
  severity: 'erro' | 'alerta'
}

export function validateItem(item: BudgetInput, index: number): ItemIssue[] {
  const issues: ItemIssue[] = []
  const push = (field: string, message: string, severity: ItemIssue['severity'] = 'erro') =>
    issues.push({ itemIndex: index, field, message, severity })
  if (!item.description?.trim()) push('description', 'Descrição não informada')
  if (!item.unit?.trim()) push('unit', 'Unidade de medida não informada')
  const q = parseDecimal(item.quantity)
  if (!q) push('quantity', 'Quantidade inválida ou não informada')
  else if (q.lte(0)) push('quantity', 'Quantidade deve ser maior que zero')
  const p = parseDecimal(item.unit_price)
  if (!p) push('unit_price', 'Preço unitário inválido ou não informado')
  else if (p.lte(0)) push('unit_price', 'Preço unitário deve ser maior que zero')
  if (!item.source?.trim()) push('source', 'Fonte da pesquisa de preço não informada')
  if (!item.reference_date) push('reference_date', 'Data de referência da pesquisa não informada')
  if (!item.document_id) push('document_id', 'Documento comprobatório não vinculado', 'alerta')
  if (!item.expense_nature?.trim()) push('expense_nature', 'Natureza de despesa não sugerida (sujeita a validação)', 'alerta')
  if (item.reference_date) {
    const ageDays = (Date.now() - new Date(item.reference_date).getTime()) / 86_400_000
    if (ageDays > 180) push('reference_date', 'Pesquisa de preço com mais de 180 dias — verificar atualização', 'alerta')
    if (ageDays < -1) push('reference_date', 'Data de referência no futuro')
  }
  if (q && p && item.total !== undefined && item.total !== '') {
    const informed = parseDecimal(item.total)
    if (!informed || !informed.eq(new Decimal(itemTotal(item.quantity, item.unit_price)))) {
      push('total', `Divergência matemática: total informado ${item.total} ≠ quantidade × preço (${itemTotal(item.quantity, item.unit_price)})`)
    }
  }
  const estimates = item.estimates ?? []
  if (estimates.length > 0 && p) {
    const ref = referencePrice(estimates, 'mediana')
    if (ref && !new Decimal(ref).eq(p)) {
      push('estimates', `Preço unitário difere da mediana das estimativas (${ref}) — registre a justificativa`, 'alerta')
    }
  }
  return issues
}

export interface BudgetSummary {
  total: string
  byCategory: { category: string; subtotal: string; count: number }[]
  issues: ItemIssue[]
  itemCount: number
}

export function summarizeBudget(items: BudgetInput[]): BudgetSummary {
  const byCat = new Map<string, { subtotal: Decimal; count: number }>()
  let total = new Decimal(0)
  const issues: ItemIssue[] = []
  items.forEach((item, i) => {
    const t = new Decimal(itemTotal(item.quantity, item.unit_price))
    total = total.add(t)
    const cat = item.category?.trim() || 'Sem categoria'
    const cur = byCat.get(cat) ?? { subtotal: new Decimal(0), count: 0 }
    byCat.set(cat, { subtotal: cur.subtotal.add(t), count: cur.count + 1 })
    issues.push(...validateItem(item, i))
  })
  return {
    total: money(total),
    byCategory: [...byCat.entries()].map(([category, v]) => ({ category, subtotal: money(v.subtotal), count: v.count })),
    issues,
    itemCount: items.length,
  }
}

/** Memória de cálculo textual, item a item. */
export function calculationMemory(items: BudgetInput[]): string[] {
  return items.map((item, i) => {
    const total = itemTotal(item.quantity, item.unit_price)
    const est = item.estimates?.length
      ? ` Estimativas: ${item.estimates.map((e) => `${e.source || 'fonte não informada'} = R$ ${formatBRL(e.unit_price)}${e.reference_date ? ` (${formatDateBR(e.reference_date)})` : ''}`).join('; ')}.`
      : ''
    return `${i + 1}. ${item.description || '(sem descrição)'}: ${formatQty(item.quantity)} ${item.unit ?? ''} × R$ ${formatBRL(item.unit_price)} = R$ ${formatBRL(total)}. Fonte: ${item.source || 'não informada'}${item.reference_date ? `, referência ${formatDateBR(item.reference_date)}` : ''}.${est}`
  })
}

export function sumDecimals(values: (string | null | undefined)[]): string {
  return money(values.reduce<Decimal>((acc, v) => acc.add(parseDecimal(v) ?? 0), new Decimal(0)))
}

export function percent(part: string, whole: string): number {
  const p = parseDecimal(part)
  const w = parseDecimal(whole)
  if (!p || !w || w.isZero()) return 0
  return p.div(w).mul(100).toDecimalPlaces(1).toNumber()
}

export function formatBRL(value: string | null | undefined): string {
  const d = parseDecimal(value ?? '0') ?? new Decimal(0)
  const [int, dec] = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2).split('.')
  const neg = int.startsWith('-')
  const digits = neg ? int.slice(1) : int
  return `${neg ? '-' : ''}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`
}

export function formatQty(value: string | null | undefined): string {
  const d = parseDecimal(value ?? '0') ?? new Decimal(0)
  return d.toString().replace('.', ',')
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
