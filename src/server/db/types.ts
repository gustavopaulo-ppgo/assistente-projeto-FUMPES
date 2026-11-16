import type {
  AccountabilityRecord,
  AiInteraction,
  AuditLog,
  FundingSource,
  LegalReference,
  OrganizationalUnit,
  Profile,
  Project,
  ProjectApproval,
  ProjectBudgetItem,
  ProjectDeliverable,
  ProjectDocument,
  ProjectExpense,
  ProjectFundingAllocation,
  ProjectIndicator,
  ProjectMember,
  ProjectObjective,
  ProjectReview,
  ProjectRisk,
  ProjectScheduleItem,
  ProjectSection,
  ProjectVersion,
  SystemSetting,
  UserRole,
} from '@/types/domain'

/** Mapa nome-da-tabela → tipo da linha. */
export interface Tables {
  organizational_units: OrganizationalUnit
  profiles: Profile
  user_roles: UserRole
  projects: Project
  project_members: ProjectMember
  project_sections: ProjectSection
  project_versions: ProjectVersion
  project_objectives: ProjectObjective
  project_indicators: ProjectIndicator
  project_budget_items: ProjectBudgetItem
  project_schedule: ProjectScheduleItem
  project_risks: ProjectRisk
  project_documents: ProjectDocument
  project_reviews: ProjectReview
  project_approvals: ProjectApproval
  legal_references: LegalReference
  funding_sources: FundingSource
  project_funding_allocations: ProjectFundingAllocation
  project_expenses: ProjectExpense
  project_deliverables: ProjectDeliverable
  accountability_records: AccountabilityRecord
  audit_logs: AuditLog
  ai_interactions: AiInteraction
  system_settings: SystemSetting
}
export type TableName = keyof Tables

/** Tabelas com exclusão lógica (coluna deleted_at). */
export const SOFT_DELETE_TABLES: ReadonlySet<TableName> = new Set<TableName>([
  'organizational_units',
  'projects',
  'project_documents',
  'legal_references',
  'project_expenses',
])

export type WhereValue = string | number | boolean | null | ReadonlyArray<string | number>
export type Where<T> = Partial<Record<keyof T & string, WhereValue>>

export interface ListOptions<T> {
  where?: Where<T>
  orderBy?: { column: keyof T & string; ascending?: boolean }
  includeDeleted?: boolean
  limit?: number
}

/**
 * Interface de persistência genérica. As regras de negócio e de
 * autorização ficam nos serviços (src/server/services), nunca aqui.
 */
export interface Store {
  readonly kind: 'memory' | 'supabase'
  list<K extends TableName>(table: K, options?: ListOptions<Tables[K]>): Promise<Tables[K][]>
  get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null>
  insert<K extends TableName>(table: K, row: Tables[K]): Promise<Tables[K]>
  update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K]>
  /** Exclusão física — usada apenas para linhas filhas sem valor histórico. */
  remove<K extends TableName>(table: K, id: string): Promise<void>
  /** Exclusão lógica para tabelas com deleted_at. */
  softDelete<K extends TableName>(table: K, id: string): Promise<void>
}
