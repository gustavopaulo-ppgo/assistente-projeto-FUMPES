/**
 * Tipos de domínio do Sistema Inteligente FUNPES.
 * Espelham as tabelas definidas em supabase/migrations.
 * Valores monetários e quantidades trafegam como string decimal
 * (ex.: "1234.56") para evitar erros de ponto flutuante.
 */

export type ISODate = string // 'YYYY-MM-DD'
export type ISODateTime = string
export type DecimalString = string

export const ROLES = [
  'proponente',
  'gestor_unidade',
  'analista_tecnico',
  'gestor_financeiro',
  'administrador',
] as const
export type Role = (typeof ROLES)[number]

export interface OrganizationalUnit {
  id: string
  name: string
  acronym: string
  city: string | null
  active: boolean
  created_at: ISODateTime
  deleted_at: ISODateTime | null
}

export interface Profile {
  id: string
  full_name: string
  email: string
  registration: string | null
  unit_id: string | null
  active: boolean
  created_at: ISODateTime
}

export interface UserRole {
  id: string
  user_id: string
  role: Role
  /** null = abrangência global (todas as unidades) */
  unit_id: string | null
  created_at: ISODateTime
}

export const PROJECT_STATUSES = [
  'rascunho',
  'em_elaboracao',
  'encaminhado',
  'em_analise',
  'correcao_solicitada',
  'validado_tecnicamente',
  'aguardando_decisao',
  'aprovado',
  'rejeitado',
  'em_execucao',
  'concluido',
  'prestacao_contas',
  'encerrado',
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export interface Project {
  id: string
  code: string
  title: string
  unit_id: string
  owner_id: string
  thematic_area: string | null
  project_type: string | null
  location: string | null
  beneficiaries: string | null
  status: ProjectStatus
  current_step: number
  completion: number
  requested_amount: DecimalString
  approved_amount: DecimalString | null
  version: number
  created_at: ISODateTime
  updated_at: ISODateTime
  deleted_at: ISODateTime | null
}

export type MemberRole = 'responsavel' | 'colaborador' | 'leitor'
export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  member_role: MemberRole
  created_at: ISODateTime
}

/** Origem de cada informação — distingue fato informado de sugestão da IA. */
export type FieldOrigin = 'servidor' | 'ia_aceita'
export interface FieldMeta {
  origin: FieldOrigin
  updated_at: ISODateTime
  updated_by: string
}

export interface ProjectSection {
  id: string
  project_id: string
  section_key: string
  content: Record<string, string>
  field_meta: Record<string, FieldMeta>
  updated_by: string
  updated_at: ISODateTime
}

export interface ProjectVersion {
  id: string
  project_id: string
  version_number: number
  snapshot: unknown
  reason: string
  created_by: string
  created_at: ISODateTime
}

export interface ProjectObjective {
  id: string
  project_id: string
  description: string
  expected_result: string | null
  position: number
}

export interface ProjectIndicator {
  id: string
  project_id: string
  name: string
  formula: string | null
  baseline: string | null
  target: string | null
  unit: string | null
  frequency: string | null
  source: string | null
  current_value: string | null
  position: number
}

export interface PriceEstimate {
  source: string
  unit_price: DecimalString
  reference_date: ISODate | null
}

export interface ProjectBudgetItem {
  id: string
  project_id: string
  description: string
  category: string | null
  unit: string | null
  quantity: DecimalString
  unit_price: DecimalString
  total: DecimalString
  source: string | null
  reference_date: ISODate | null
  document_id: string | null
  expense_nature: string | null
  justification: string | null
  estimates: PriceEstimate[]
  position: number
}

export interface ProjectScheduleItem {
  id: string
  project_id: string
  activity: string
  responsible: string | null
  start_date: ISODate | null
  end_date: ISODate | null
  is_milestone: boolean
  depends_on: string | null
  planned_amount: DecimalString
  position: number
}

export type RiskCategory = 'tecnico' | 'financeiro' | 'administrativo' | 'outro'
export interface ProjectRisk {
  id: string
  project_id: string
  category: RiskCategory
  description: string
  probability: number
  impact: number
  mitigation: string | null
  owner: string | null
  position: number
}

export const DOCUMENT_STATUSES = ['pendente', 'apresentado', 'conferido', 'rejeitado'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]
export type DocumentContext = 'elaboracao' | 'execucao' | 'prestacao_contas'

export interface ProjectDocument {
  id: string
  project_id: string
  context: DocumentContext
  category: string
  name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  sha256: string
  status: DocumentStatus
  review_note: string | null
  uploaded_by: string
  created_at: ISODateTime
  deleted_at: ISODateTime | null
}

export type ReviewType = 'gestor_unidade' | 'tecnica' | 'financeira'
export type ReviewRecommendation = 'favoravel' | 'correcao' | 'desfavoravel' | 'informativa'
export interface ProjectReview {
  id: string
  project_id: string
  reviewer_id: string
  review_type: ReviewType
  recommendation: ReviewRecommendation
  opinion: string
  created_at: ISODateTime
}

/** Registro de cada transição de estado (histórico de tramitação). */
export interface ProjectApproval {
  id: string
  project_id: string
  from_status: ProjectStatus
  to_status: ProjectStatus
  actor_id: string
  note: string | null
  administrative_reference: string | null
  created_at: ISODateTime
}

export type LegalValidationStatus = 'nao_verificada' | 'verificada' | 'desatualizada'
export interface LegalRule {
  /** Tipos de projeto aos quais a regra se aplica (chaves de PROJECT_TYPES) */
  project_types: string[]
  /** Dispositivo (artigo/inciso) — somente preencher após conferência humana */
  provision: string | null
  summary: string
  /** 'permite' | 'restringe' | 'exige_documento' */
  effect: 'permite' | 'restringe' | 'exige_documento'
  required_documents: string[]
  restrictions: string[]
}
export interface LegalReference {
  id: string
  title: string
  number: string
  date: ISODate | null
  issuer: string
  official_url: string | null
  text: string | null
  version: string | null
  last_verified_at: ISODate | null
  validation_status: LegalValidationStatus
  validated_by: string | null
  categories: string[]
  rules: LegalRule[]
  created_at: ISODateTime
  deleted_at: ISODateTime | null
}

export interface FundingSource {
  id: string
  name: string
  code: string
  description: string | null
  active: boolean
}

export interface ProjectFundingAllocation {
  id: string
  project_id: string
  funding_source_id: string
  amount: DecimalString
  notes: string | null
}

export type ExpenseStatus = 'lancada' | 'conferida' | 'rejeitada'
export interface ProjectExpense {
  id: string
  project_id: string
  budget_item_id: string | null
  description: string
  supplier: string | null
  invoice_number: string | null
  issue_date: ISODate | null
  payment_date: ISODate | null
  amount: DecimalString
  status: ExpenseStatus
  document_id: string | null
  created_by: string
  created_at: ISODateTime
  deleted_at: ISODateTime | null
}

export type DeliverableStatus = 'planejada' | 'em_andamento' | 'entregue' | 'cancelada'
export interface ProjectDeliverable {
  id: string
  project_id: string
  goal: string
  description: string | null
  planned_date: ISODate | null
  delivered_date: ISODate | null
  physical_progress: number
  status: DeliverableStatus
  document_id: string | null
  created_at: ISODateTime
}

export interface AccountabilityRecord {
  id: string
  project_id: string
  item: string
  status: DocumentStatus
  document_id: string | null
  reviewer_id: string | null
  note: string | null
  updated_at: ISODateTime
}

export interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  entity: string
  entity_id: string | null
  project_id: string | null
  details: Record<string, unknown>
  created_at: ISODateTime
}

export type AiInteractionStatus = 'sugerida' | 'aceita' | 'parcial' | 'descartada' | 'erro'
export interface AiInteraction {
  id: string
  project_id: string
  user_id: string
  step: number
  user_message: string
  provider: string
  model: string
  response: unknown
  status: AiInteractionStatus
  accepted_fields: string[]
  created_at: ISODateTime
}

export interface SystemSetting {
  id: string // chave
  value: unknown
  updated_at: ISODateTime
  updated_by: string | null
}

/** Usuário autenticado com seus papéis carregados do banco. */
export interface SessionUser {
  id: string
  profile: Profile
  roles: UserRole[]
}
