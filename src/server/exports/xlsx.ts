import ExcelJS from 'exceljs'
import { calculationMemory, parseDecimal, summarizeBudget } from '@/features/budget/calc'
import { executionSummary } from '@/features/execution/summary'
import type { ProjectBundle } from '@/types/bundle'

const num = (v: string | null | undefined) => (parseDecimal(v)?.toNumber() ?? 0)
const date = (v: string | null | undefined) => (v ? new Date(`${v}T12:00:00Z`) : null)

/** Sanitiza texto para impedir injeção de fórmulas (CSV/Excel injection). */
export function safeCell(v: string | null | undefined): string {
  const s = v ?? ''
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } }
  row.alignment = { vertical: 'middle', wrapText: true }
}

export async function renderBudgetXlsx(b: ProjectBundle, kind: 'orcamento' | 'cronograma'): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Sistema Inteligente FUNPES'
  wb.created = new Date()

  if (kind === 'orcamento') {
    const ws = wb.addWorksheet('Orçamento', { views: [{ state: 'frozen', ySplit: 4 }] })
    ws.addRow([safeCell(`${b.project.code} — ${b.project.title}`)]).font = { bold: true, size: 13 }
    ws.addRow([safeCell(`Unidade: ${b.unit?.name ?? '—'}`)])
    ws.addRow([])
    const header = ws.addRow(['#', 'Descrição', 'Categoria', 'Unidade', 'Quantidade', 'Preço unitário (R$)', 'Total (R$)', 'Fonte da pesquisa', 'Data de referência', 'Natureza de despesa (sugerida)', 'Documento comprobatório', 'Justificativa'])
    styleHeader(header)
    b.budget.forEach((i, idx) => {
      const r = ws.addRow([
        idx + 1,
        safeCell(i.description),
        safeCell(i.category),
        safeCell(i.unit),
        num(i.quantity),
        num(i.unit_price),
        null,
        safeCell(i.source),
        date(i.reference_date),
        safeCell(i.expense_nature),
        safeCell(b.documents.find((d) => d.id === i.document_id)?.name ?? ''),
        safeCell(i.justification),
      ])
      // Total como fórmula (auditável), com o resultado calculado em decimal exato como valor em cache.
      r.getCell(7).value = { formula: `E${r.number}*F${r.number}`, result: num(i.total) }
    })
    const first = 5
    const last = 4 + b.budget.length
    const totalRow = ws.addRow(['', 'TOTAL GERAL', '', '', '', '', b.budget.length ? { formula: `SUM(G${first}:G${last})`, result: num(summarizeBudget(b.budget).total) } : 0])
    totalRow.font = { bold: true }
    ws.getColumn(5).numFmt = '#,##0.###'
    ws.getColumn(6).numFmt = '"R$" #,##0.00'
    ws.getColumn(7).numFmt = '"R$" #,##0.00'
    ws.getColumn(9).numFmt = 'dd/mm/yyyy'
    ;[5, 45, 22, 10, 12, 18, 18, 35, 14, 18, 30, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w))

    const est = wb.addWorksheet('Estimativas')
    styleHeader(est.addRow(['Item', 'Fonte', 'Preço unitário (R$)', 'Data']))
    for (const i of b.budget) for (const e of i.estimates) est.addRow([safeCell(i.description), safeCell(e.source), num(e.unit_price), date(e.reference_date)])
    est.getColumn(3).numFmt = '"R$" #,##0.00'
    est.getColumn(4).numFmt = 'dd/mm/yyyy'
    ;[45, 40, 18, 14].forEach((w, i) => (est.getColumn(i + 1).width = w))

    const mem = wb.addWorksheet('Memória de cálculo')
    mem.getColumn(1).width = 140
    mem.addRow(['Memória de cálculo']).font = { bold: true }
    for (const line of calculationMemory(b.budget)) mem.addRow([safeCell(line)]).alignment = { wrapText: true }
    mem.addRow([])
    mem.addRow(['Natureza de despesa sugerida, sujeita a validação pela área orçamentária competente.']).font = { italic: true }

    if (b.expenses.length) {
      const ex = executionSummary(b)
      const ws2 = wb.addWorksheet('Previsto x Executado')
      styleHeader(ws2.addRow(['Item', 'Previsto (R$)', 'Executado (R$)', 'Saldo (R$)', '%']))
      for (const l of ex.lines) ws2.addRow([safeCell(l.description), num(l.planned), num(l.executed), num(l.balance), l.percent / 100])
      ;[2, 3, 4].forEach((c) => (ws2.getColumn(c).numFmt = '"R$" #,##0.00'))
      ws2.getColumn(5).numFmt = '0.0%'
      ws2.getColumn(1).width = 50
    }
  } else {
    const ws = wb.addWorksheet('Cronograma físico-financeiro', { views: [{ state: 'frozen', ySplit: 2 }] })
    ws.addRow([safeCell(`${b.project.code} — Cronograma físico-financeiro`)]).font = { bold: true, size: 13 }
    styleHeader(ws.addRow(['#', 'Atividade', 'Responsável', 'Início', 'Término', 'Marco de entrega', 'Depende de', 'Desembolso previsto (R$)']))
    const byId = new Map(b.schedule.map((s, i) => [s.id, i + 1]))
    b.schedule.forEach((s, idx) =>
      ws.addRow([idx + 1, safeCell(s.activity), safeCell(s.responsible), date(s.start_date), date(s.end_date), s.is_milestone ? 'Sim' : 'Não', s.depends_on ? `#${byId.get(s.depends_on) ?? '?'}` : '', num(s.planned_amount)]),
    )
    ws.getColumn(4).numFmt = 'dd/mm/yyyy'
    ws.getColumn(5).numFmt = 'dd/mm/yyyy'
    ws.getColumn(8).numFmt = '"R$" #,##0.00'
    ;[5, 45, 25, 12, 12, 14, 12, 20].forEach((w, i) => (ws.getColumn(i + 1).width = w))

    // Desembolso mensal (distribuição no mês de término de cada atividade)
    const monthly = new Map<string, number>()
    for (const s of b.schedule) if (s.end_date) monthly.set(s.end_date.slice(0, 7), (monthly.get(s.end_date.slice(0, 7)) ?? 0) + num(s.planned_amount))
    const ws2 = wb.addWorksheet('Desembolso mensal')
    styleHeader(ws2.addRow(['Mês (término da atividade)', 'Desembolso previsto (R$)']))
    for (const [m, v] of [...monthly.entries()].sort()) ws2.addRow([m, v])
    ws2.getColumn(2).numFmt = '"R$" #,##0.00'
    ws2.getColumn(1).width = 28
    ws2.getColumn(2).width = 24
  }
  return new Uint8Array(await wb.xlsx.writeBuffer())
}
