import type {
  AccountabilityRecord,
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
} from './domain'

/** Projeto com todos os dados relacionados, carregado para exibição/exportação. */
export interface ProjectBundle {
  project: Project
  unit: OrganizationalUnit | null
  owner: Profile | null
  members: ProjectMember[]
  memberProfiles: Profile[]
  sections: Record<string, ProjectSection>
  objectives: ProjectObjective[]
  indicators: ProjectIndicator[]
  budget: ProjectBudgetItem[]
  schedule: ProjectScheduleItem[]
  risks: ProjectRisk[]
  documents: ProjectDocument[]
  reviews: ProjectReview[]
  approvals: ProjectApproval[]
  versions: ProjectVersion[]
  deliverables: ProjectDeliverable[]
  expenses: ProjectExpense[]
  accountability: AccountabilityRecord[]
  allocations: ProjectFundingAllocation[]
}
