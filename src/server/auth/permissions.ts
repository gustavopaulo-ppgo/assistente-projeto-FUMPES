import {
  ANALYSIS_STATUSES,
  EDITABLE_STATUSES,
  EXECUTION_STATUSES,
  type Actor,
  type TransitionDef,
  type WorkflowConfig,
} from '@/features/workflow/config'
import type { Project, ProjectMember, ReviewType, Role, SessionUser } from '@/types/domain'

/**
 * Regras de autorização — funções puras, chamadas pelos serviços em TODA
 * operação. A interface pode ocultar botões, mas nunca é a única barreira.
 */

export class PermissionError extends Error {
  readonly status = 403
  constructor(message = 'Você não tem permissão para executar esta operação.') {
    super(message)
    this.name = 'PermissionError'
  }
}

export class NotFoundError extends Error {
  readonly status = 404
  constructor(message = 'Registro não encontrado.') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error {
  readonly status = 422
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** Papel válido para a unidade informada (papéis sem unidade têm abrangência global). */
export function hasRole(user: SessionUser, role: Role, unitId?: string | null): boolean {
  return user.roles.some((r) => r.role === role && (r.unit_id === null || unitId === undefined || r.unit_id === unitId))
}

export function hasAnyRole(user: SessionUser, roles: Role[], unitId?: string | null): boolean {
  return roles.some((r) => hasRole(user, r, unitId))
}

export const isAdmin = (user: SessionUser) => hasRole(user, 'administrador')

export function membership(user: SessionUser, project: Project, members: ProjectMember[]) {
  if (project.owner_id === user.id) return 'responsavel' as const
  const m = members.find((mm) => mm.project_id === project.id && mm.user_id === user.id)
  return m?.member_role ?? null
}

const PRE_SUBMISSION = new Set(['rascunho', 'em_elaboracao'])

export function canViewProject(user: SessionUser, project: Project, members: ProjectMember[]): boolean {
  if (!user.profile.active) return false
  if (isAdmin(user)) return true
  if (membership(user, project, members)) return true
  if (hasRole(user, 'gestor_unidade', project.unit_id)) return true
  // Analistas e gestores financeiros só enxergam projetos já encaminhados.
  if (!PRE_SUBMISSION.has(project.status) && hasAnyRole(user, ['analista_tecnico', 'gestor_financeiro'], project.unit_id)) {
    return true
  }
  return false
}

export function canCreateProject(user: SessionUser): boolean {
  return user.profile.active && hasAnyRole(user, ['proponente', 'gestor_unidade'])
}

/** Edição do conteúdo técnico (etapas 1–10). */
export function canEditContent(user: SessionUser, project: Project, members: ProjectMember[]): boolean {
  if (!user.profile.active || project.deleted_at) return false
  if (!EDITABLE_STATUSES.has(project.status)) return false
  const m = membership(user, project, members)
  return m === 'responsavel' || m === 'colaborador'
}

/** Lançamento de metas, entregas, despesas e evidências de execução. */
export function canManageExecution(user: SessionUser, project: Project, members: ProjectMember[]): boolean {
  if (!user.profile.active || !EXECUTION_STATUSES.has(project.status)) return false
  const m = membership(user, project, members)
  return m === 'responsavel' || m === 'colaborador' || hasRole(user, 'gestor_financeiro', project.unit_id)
}

/** Conferência (conferido/rejeitado) de documentos e despesas — somente revisão humana autorizada. */
export function canReviewAccountability(user: SessionUser, project: Project): boolean {
  return user.profile.active && EXECUTION_STATUSES.has(project.status) && hasRole(user, 'gestor_financeiro', project.unit_id)
}

/** Conferência de documentos da fase de elaboração (análise técnica). */
export function canReviewDocuments(user: SessionUser, project: Project): boolean {
  if (!user.profile.active) return false
  if (EXECUTION_STATUSES.has(project.status)) return canReviewAccountability(user, project)
  return ANALYSIS_STATUSES.has(project.status) && hasAnyRole(user, ['analista_tecnico', 'gestor_financeiro'], project.unit_id)
}

export function reviewTypesFor(user: SessionUser, project: Project): ReviewType[] {
  if (!user.profile.active) return []
  const reviewable = ANALYSIS_STATUSES.has(project.status) || EXECUTION_STATUSES.has(project.status)
  if (!reviewable) return []
  const types: ReviewType[] = []
  if (hasRole(user, 'gestor_unidade', project.unit_id)) types.push('gestor_unidade')
  if (hasRole(user, 'analista_tecnico', project.unit_id)) types.push('tecnica')
  if (hasRole(user, 'gestor_financeiro', project.unit_id)) types.push('financeira')
  return types
}

/** Conjunto de "atores" que o usuário representa em relação ao projeto. */
export function actorsFor(user: SessionUser, project: Project, members: ProjectMember[]): Set<Actor> {
  const actors = new Set<Actor>()
  if (!user.profile.active) return actors
  for (const r of user.roles) {
    if (r.unit_id === null || r.unit_id === project.unit_id) actors.add(r.role)
  }
  const m = membership(user, project, members)
  if (m === 'responsavel') actors.add('responsavel')
  if (m === 'colaborador') actors.add('colaborador')
  // Ninguém analisa ou decide sobre o próprio projeto (segregação de funções).
  if (m === 'responsavel' || m === 'colaborador') {
    for (const r of ['gestor_unidade', 'analista_tecnico', 'gestor_financeiro', 'administrador'] as const) actors.delete(r)
  }
  return actors
}

export function allowedTransitions(
  workflow: WorkflowConfig,
  user: SessionUser,
  project: Project,
  members: ProjectMember[],
): TransitionDef[] {
  const actors = actorsFor(user, project, members)
  return workflow.transitions.filter((t) => t.from === project.status && t.actors.some((a) => actors.has(a)))
}

export function canManageUsers(user: SessionUser) {
  return isAdmin(user)
}
export function canManageLegalReferences(user: SessionUser) {
  return isAdmin(user)
}
export function canManageSettings(user: SessionUser) {
  return isAdmin(user)
}
