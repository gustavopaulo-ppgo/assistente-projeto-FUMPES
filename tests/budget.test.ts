import { describe, expect, it } from 'vitest'
import {
  calculationMemory,
  formatBRL,
  itemTotal,
  parseDecimal,
  referencePrice,
  summarizeBudget,
  validateItem,
  type BudgetInput,
} from '@/features/budget/calc'

const base: BudgetInput = {
  description: 'Item',
  category: 'Equipamento',
  unit: 'un',
  quantity: '1',
  unit_price: '1',
  source: 'Cotação A',
  reference_date: new Date().toISOString().slice(0, 10),
  expense_nature: '4.4.90.52',
  document_id: '00000000-0000-4000-8000-000000000001',
}

describe('cálculo orçamentário com decimais exatos', () => {
  it('evita erro de ponto flutuante (0,1 × 3 = 0,30)', () => {
    expect(0.1 * 3).not.toBe(0.3) // prova do problema com float
    expect(itemTotal('3', '0.1')).toBe('0.30')
  })

  it('aceita formato brasileiro e arredonda meio para cima', () => {
    expect(parseDecimal('1.234,56')?.toString()).toBe('1234.56')
    expect(parseDecimal('R$ 10,5')?.toString()).toBe('10.5')
    expect(parseDecimal('abc')).toBeNull()
    expect(itemTotal('1', '0.005')).toBe('0.01')
    expect(itemTotal('3', '33.333')).toBe('100.00')
  })

  it('soma subtotais por categoria e total geral sem perda de precisão', () => {
    const items = Array.from({ length: 10 }, () => ({ ...base, quantity: '1', unit_price: '0.1' }))
    const s = summarizeBudget([...items, { ...base, category: 'Serviço', quantity: '2', unit_price: '1999.9995' }])
    expect(s.total).toBe('4001.00')
    expect(s.byCategory).toEqual([
      { category: 'Equipamento', subtotal: '1.00', count: 10 },
      { category: 'Serviço', subtotal: '4000.00', count: 1 },
    ])
  })

  it('valores grandes mantêm precisão', () => {
    expect(itemTotal('1000000', '99999999.99')).toBe('99999999990000.00')
  })

  it('identifica campos incompletos e divergência matemática', () => {
    const issues = validateItem({ ...base, description: '', source: '', quantity: '0', total: '50.00', unit_price: '10' }, 0)
    const fields = issues.map((i) => i.field)
    expect(fields).toEqual(expect.arrayContaining(['description', 'source', 'quantity']))
    const div = validateItem({ ...base, quantity: '2', unit_price: '10', total: '25.00' }, 0)
    expect(div.find((i) => i.field === 'total')?.message).toMatch(/Divergência/)
    expect(validateItem({ ...base, quantity: '2', unit_price: '10', total: '20.00' }, 0).filter((i) => i.severity === 'erro')).toEqual([])
  })

  it('alerta pesquisa de preço antiga e preço diferente da mediana das estimativas', () => {
    const old = validateItem({ ...base, reference_date: '2020-01-01' }, 0)
    expect(old.some((i) => i.message.includes('180 dias'))).toBe(true)
    const est = validateItem(
      {
        ...base,
        unit_price: '120',
        estimates: [
          { source: 'A', unit_price: '100', reference_date: null },
          { source: 'B', unit_price: '110', reference_date: null },
          { source: 'C', unit_price: '130', reference_date: null },
        ],
      },
      0,
    )
    expect(est.some((i) => i.field === 'estimates')).toBe(true)
  })

  it('múltiplas estimativas: mediana, média e menor preço', () => {
    const e = [
      { source: 'A', unit_price: '100', reference_date: null },
      { source: 'B', unit_price: '110,50', reference_date: null },
      { source: 'C', unit_price: '130', reference_date: null },
      { source: 'D', unit_price: '90', reference_date: null },
    ]
    expect(referencePrice(e, 'mediana')).toBe('105.25')
    expect(referencePrice(e, 'media')).toBe('107.63')
    expect(referencePrice(e, 'menor')).toBe('90.00')
    expect(referencePrice([], 'mediana')).toBeNull()
  })

  it('gera memória de cálculo e formata em reais', () => {
    expect(formatBRL('1234567.891')).toBe('1.234.567,89')
    const mem = calculationMemory([{ ...base, description: 'Monitor', quantity: '20', unit_price: '1120.50' }])
    expect(mem[0]).toContain('20 un × R$ 1.120,50 = R$ 22.410,00')
  })
})

describe('validação de escala decimal (coerente com o banco)', () => {
  it('rejeita preço com mais de 2 casas e quantidade com mais de 3', async () => {
    const { budgetRowSchema } = await import('@/server/validation/schemas')
    const base = { description: 'x', unit: 'un', source: 's', reference_date: '2026-01-01' }
    expect(budgetRowSchema.safeParse({ ...base, quantity: '1,5', unit_price: '10,25' }).success).toBe(true)
    expect(budgetRowSchema.safeParse({ ...base, quantity: '1', unit_price: '10,255' }).success).toBe(false)
    expect(budgetRowSchema.safeParse({ ...base, quantity: '1,0005', unit_price: '10' }).success).toBe(false)
    expect(budgetRowSchema.safeParse({ ...base, quantity: '1,125', unit_price: '10' }).success).toBe(true)
  })
})
