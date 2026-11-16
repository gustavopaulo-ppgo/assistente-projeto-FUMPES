import { z } from 'zod'
import { parseDecimal } from '@/features/budget/calc'
import { PROJECT_TYPES, THEMATIC_AREAS } from '@/features/projects/steps'
import { DOCUMENT_STATUSES, PROJECT_STATUSES, ROLES } from '@/types/domain'

/** Identificador no formato UUID (aceita qualquer variante). */
export const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Identificador inválido')

/** Remove caracteres de controle (exceto quebras de linha/tab) e espaços nas pontas. */
export function cleanText(value: string): string {
   
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
}

export const text = (max: number) => z.string().max(max, `Máximo de ${max} caracteres`).transform(cleanText)
export const requiredText = (max: number, label = 'Campo') =>
  z.string().transform(cleanText).pipe(z.string().min(1, `${label} é obrigatório`).max(max, `Máximo de ${max} caracteres`))
export const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Máximo de ${max} caracteres`)
    .transform(cleanText)
    .nullish()
    .transform((v) => (v ? v : null))

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida')
export const optionalDate = z
  .union([isoDate, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null))

/** Decimal em string (aceita vírgula). Normaliza para ponto. */
/** Decimal em string; `scale` = casas decimais máximas (coerente com numeric do banco). */
export const decimalString = (opts: { min?: number; allowEmpty?: boolean; scale?: number } = {}) =>
  z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      const s = String(v).trim()
      if (s === '' && opts.allowEmpty) return '0'
      const d = parseDecimal(s)
      if (!d) {
        ctx.addIssue({ code: 'custom', message: 'Número inválido' })
        return z.NEVER
      }
      if (opts.min !== undefined && d.lt(opts.min)) {
        ctx.addIssue({ code: 'custom', message: `Valor mínimo: ${opts.min}` })
        return z.NEVER
      }
      const scale = opts.scale ?? 2
      if (d.decimalPlaces() > scale) {
        ctx.addIssue({ code: 'custom', message: `Use no máximo ${scale} casas decimais` })
        return z.NEVER
      }
      if (d.abs().gte('1e12')) {
        ctx.addIssue({ code: 'custom', message: 'Valor excede o limite permitido' })
        return z.NEVER
      }
      return d.toString()
    })

export const projectTypeSchema = z.enum(PROJECT_TYPES.map((p) => p.value) as [string, ...string[]])
export const thematicAreaSchema = z.enum(THEMATIC_AREAS as unknown as [string, ...string[]])

export const createProjectSchema = z.object({
  title: requiredText(200, 'Título'),
  unit_id: idSchema,
  project_type: projectTypeSchema,
  thematic_area: thematicAreaSchema.optional().nullable(),
})
export type CreateProjectInput = z.input<typeof createProjectSchema>

const rowId = idSchema.optional().nullable()

export const objectiveRowSchema = z.object({
  id: rowId,
  description: requiredText(1000, 'Objetivo específico'),
  expected_result: optionalText(1000),
})

export const indicatorRowSchema = z.object({
  id: rowId,
  name: requiredText(300, 'Nome do indicador'),
  formula: optionalText(500),
  baseline: optionalText(200),
  target: optionalText(200),
  unit: optionalText(60),
  frequency: optionalText(60),
  source: optionalText(300),
})

const estimateSchema = z.object({
  source: requiredText(300, 'Fonte da estimativa'),
  unit_price: decimalString({ min: 0 }),
  reference_date: optionalDate,
})

export const budgetRowSchema = z.object({
  id: rowId,
  description: requiredText(500, 'Descrição'),
  category: optionalText(120),
  unit: optionalText(40),
  quantity: decimalString({ min: 0, allowEmpty: true, scale: 3 }),
  unit_price: decimalString({ min: 0, allowEmpty: true }),
  source: optionalText(500),
  reference_date: optionalDate,
  document_id: idSchema.optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
  expense_nature: optionalText(40),
  justification: optionalText(2000),
  estimates: z.array(estimateSchema).max(10).default([]),
})

export const scheduleRowSchema = z
  .object({
    id: rowId,
    activity: requiredText(500, 'Atividade'),
    responsible: optionalText(200),
    start_date: optionalDate,
    end_date: optionalDate,
    is_milestone: z.union([z.boolean(), z.literal('true'), z.literal('false')]).transform((v) => v === true || v === 'true'),
    depends_on: idSchema.optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
    planned_amount: decimalString({ min: 0, allowEmpty: true }),
  })
  .refine((r) => !r.start_date || !r.end_date || r.end_date >= r.start_date, {
    message: 'Data de término anterior à de início',
    path: ['end_date'],
  })

export const riskRowSchema = z.object({
  id: rowId,
  category: z.enum(['tecnico', 'financeiro', 'administrativo', 'outro']),
  description: requiredText(1000, 'Descrição do risco'),
  probability: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  mitigation: optionalText(1000),
  owner: optionalText(200),
})

export const TABLE_SCHEMAS = {
  objectives: objectiveRowSchema,
  indicators: indicatorRowSchema,
  budget: budgetRowSchema,
  schedule: scheduleRowSchema,
  risks: riskRowSchema,
} as const
export type TableEntity = keyof typeof TABLE_SCHEMAS

export const transitionSchema = z.object({
  to: z.enum(PROJECT_STATUSES),
  note: optionalText(4000),
  administrative_reference: optionalText(300),
})

export const reviewSchema = z.object({
  review_type: z.enum(['gestor_unidade', 'tecnica', 'financeira']),
  recommendation: z.enum(['favoravel', 'correcao', 'desfavoravel', 'informativa']),
  opinion: requiredText(8000, 'Parecer'),
})

export const documentStatusSchema = z.object({
  status: z.enum(DOCUMENT_STATUSES),
  note: optionalText(2000),
})

export const deliverableSchema = z.object({
  id: rowId,
  goal: requiredText(500, 'Meta'),
  description: optionalText(2000),
  planned_date: optionalDate,
  delivered_date: optionalDate,
  physical_progress: z.coerce.number().int().min(0).max(100),
  status: z.enum(['planejada', 'em_andamento', 'entregue', 'cancelada']),
  document_id: idSchema.optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
})

export const expenseSchema = z.object({
  id: rowId,
  budget_item_id: idSchema.optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
  description: requiredText(500, 'Descrição'),
  supplier: optionalText(300),
  invoice_number: optionalText(100),
  issue_date: optionalDate,
  payment_date: optionalDate,
  amount: decimalString({ min: 0.01 }),
  document_id: idSchema.optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
})

export const legalRuleSchema = z.object({
  project_types: z.array(projectTypeSchema).min(1),
  provision: optionalText(200),
  summary: requiredText(2000, 'Resumo da regra'),
  effect: z.enum(['permite', 'restringe', 'exige_documento']),
  required_documents: z.array(requiredText(300)).max(30).default([]),
  restrictions: z.array(requiredText(500)).max(30).default([]),
})

export const legalReferenceSchema = z.object({
  id: rowId,
  title: requiredText(300, 'Título'),
  number: requiredText(120, 'Número'),
  date: optionalDate,
  issuer: requiredText(200, 'Órgão emissor'),
  official_url: z
    .union([z.string().url().startsWith('https://', 'Use URL https oficial'), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  text: optionalText(200_000),
  version: optionalText(60),
  categories: z.array(requiredText(60)).max(20).default([]),
  rules: z.array(legalRuleSchema).max(50).default([]),
})

export const unitSchema = z.object({
  id: rowId,
  name: requiredText(200, 'Nome'),
  acronym: requiredText(30, 'Sigla'),
  city: optionalText(120),
  active: z.boolean().default(true),
})

export const userAdminSchema = z.object({
  id: rowId,
  full_name: requiredText(200, 'Nome'),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(200),
  registration: optionalText(40),
  unit_id: idSchema.nullable(),
  active: z.boolean(),
  roles: z
    .array(z.object({ role: z.enum(ROLES), unit_id: idSchema.nullable() }))
    .max(10),
})

export const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  member_role: z.enum(['colaborador', 'leitor']),
})

export const dashboardFiltersSchema = z.object({
  from: optionalDate,
  to: optionalDate,
  unit_id: idSchema.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  project_type: z.string().max(60).optional().transform((v) => (v ? v : undefined)),
  owner_id: idSchema.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  status: z.enum(PROJECT_STATUSES).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
})
export type DashboardFilters = Partial<z.output<typeof dashboardFiltersSchema>>

/** Formata erros do Zod em mensagens legíveis. */
export function zodMessages(error: z.ZodError): string[] {
  return error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
}
