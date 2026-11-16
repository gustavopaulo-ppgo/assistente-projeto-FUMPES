import { z } from 'zod'
import { DEFAULT_WORKFLOW } from '@/features/workflow/config'

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve estar no formato #RRGGBB')

export const institutionSchema = z.object({
  institution_name: z.string().min(3).max(200),
  department_name: z.string().max(200),
  system_name: z.string().min(3).max(120),
  primary_color: hexColor,
  accent_color: hexColor,
  /** Logotipo autorizado (PNG/JPEG em data URL). SVG não é aceito por segurança. */
  logo_data_url: z
    .string()
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
    .max(400_000)
    .nullable(),
})
export type InstitutionSettings = z.infer<typeof institutionSchema>

export const documentTemplateSchema = z.object({
  cover_title: z.string().max(200),
  cover_subtitle: z.string().max(300),
  header_text: z.string().max(200),
  footer_text: z.string().max(300),
  disclaimer: z.string().max(1500),
  section_titles: z.record(z.string(), z.string().max(120)),
  section_intros: z.record(z.string(), z.string().max(1500)),
})
export type DocumentTemplate = z.infer<typeof documentTemplateSchema>

export const retentionSchema = z.object({
  ai_interactions_days: z.number().int().min(30).max(3650),
  audit_logs_days: z.number().int().min(365).max(7300),
})
export type RetentionSettings = z.infer<typeof retentionSchema>

export const DEFAULT_INSTITUTION: InstitutionSettings = {
  institution_name: 'Polícia Penal do Estado de Goiás',
  department_name: 'Fundo Penitenciário Estadual — FUNPES',
  system_name: 'Sistema Inteligente FUNPES',
  primary_color: '#1f3a5f',
  accent_color: '#b8892b',
  logo_data_url: null,
}

export const DEFAULT_DOCUMENT_TEMPLATE: DocumentTemplate = {
  cover_title: 'PROJETO INSTITUCIONAL',
  cover_subtitle: 'Proposta para utilização de recursos do Fundo Penitenciário Estadual — FUNPES',
  header_text: 'Polícia Penal do Estado de Goiás',
  footer_text: 'Documento gerado pelo Sistema Inteligente FUNPES',
  disclaimer:
    'Este documento é uma proposta técnica elaborada com apoio de ferramenta informatizada. A análise de enquadramento é preliminar e não substitui a análise jurídica, técnica e orçamentária competente, nem constitui decisão administrativa.',
  section_titles: {
    apresentacao: 'Apresentação',
    identificacao: 'Identificação do Projeto',
    diagnostico: 'Diagnóstico',
    justificativa: 'Justificativa',
    objetivos: 'Objetivos, Metas e Indicadores',
    metodologia: 'Metodologia',
    solucao: 'Especificação da Solução',
    beneficiarios: 'Público Beneficiário',
    orcamento: 'Orçamento',
    cronograma: 'Cronograma',
    riscos: 'Riscos e Mitigação',
    fundamentacao: 'Fundamentação Normativa',
    conclusao: 'Conclusão',
    anexos: 'Anexos',
  },
  section_intros: {},
}

export const DEFAULT_RETENTION: RetentionSettings = {
  ai_interactions_days: 365,
  audit_logs_days: 1825,
}

export const SETTING_KEYS = {
  institution: 'institution',
  workflow: 'workflow',
  documentTemplate: 'document_template',
  retention: 'retention',
} as const

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  [SETTING_KEYS.institution]: DEFAULT_INSTITUTION,
  [SETTING_KEYS.workflow]: DEFAULT_WORKFLOW,
  [SETTING_KEYS.documentTemplate]: DEFAULT_DOCUMENT_TEMPLATE,
  [SETTING_KEYS.retention]: DEFAULT_RETENTION,
}
