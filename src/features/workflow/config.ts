import { z } from 'zod'
import { PROJECT_STATUSES, ROLES, type ProjectStatus, type Role } from '@/types/domain'

/**
 * Fluxo de estados dos projetos.
 * Os estados do sistema NÃO equivalem a decisões oficiais registradas nos
 * sistemas administrativos do Estado.
 */

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  rascunho: 'Rascunho',
  em_elaboracao: 'Em elaboração',
  encaminhado: 'Encaminhado',
  em_analise: 'Em análise',
  correcao_solicitada: 'Correção solicitada',
  validado_tecnicamente: 'Validado tecnicamente',
  aguardando_decisao: 'Aguardando decisão',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  em_execucao: 'Em execução',
  concluido: 'Concluído',
  prestacao_contas: 'Prestação de contas',
  encerrado: 'Encerrado',
}

/** Estados em que o conteúdo do projeto pode ser editado pelos proponentes. */
export const EDITABLE_STATUSES: ReadonlySet<ProjectStatus> = new Set(['rascunho', 'em_elaboracao', 'correcao_solicitada'])
/** Estados em que dados de execução e prestação de contas podem ser lançados. */
export const EXECUTION_STATUSES: ReadonlySet<ProjectStatus> = new Set(['em_execucao', 'concluido', 'prestacao_contas'])
export const ANALYSIS_STATUSES: ReadonlySet<ProjectStatus> = new Set([
  'encaminhado',
  'em_analise',
  'correcao_solicitada',
  'validado_tecnicamente',
  'aguardando_decisao',
])

/** Ator de uma transição: um papel institucional ou o vínculo com o projeto. */
export const ACTORS = [...ROLES, 'responsavel', 'colaborador'] as const
export type Actor = (typeof ACTORS)[number]

const transitionSchema = z.object({
  from: z.enum(PROJECT_STATUSES),
  to: z.enum(PROJECT_STATUSES),
  label: z.string().min(2).max(80),
  actors: z.array(z.enum(ACTORS)).min(1),
  requireNote: z.boolean().default(false),
  /** Exige referência a ato/processo administrativo (ex.: nº SEI) — evidência da decisão humana. */
  requireAdministrativeReference: z.boolean().default(false),
  /** Exige que o projeto não tenha pendências obrigatórias. */
  requireComplete: z.boolean().default(false),
})
export type TransitionDef = z.infer<typeof transitionSchema>

export const workflowSchema = z.object({
  transitions: z.array(transitionSchema).min(1),
})
export type WorkflowConfig = z.infer<typeof workflowSchema>

const T = (
  from: ProjectStatus,
  to: ProjectStatus,
  label: string,
  actors: Actor[],
  extra: Partial<Pick<TransitionDef, 'requireNote' | 'requireAdministrativeReference' | 'requireComplete'>> = {},
): TransitionDef => ({
  from,
  to,
  label,
  actors,
  requireNote: extra.requireNote ?? false,
  requireAdministrativeReference: extra.requireAdministrativeReference ?? false,
  requireComplete: extra.requireComplete ?? false,
})

export const DEFAULT_WORKFLOW: WorkflowConfig = {
  transitions: [
    T('rascunho', 'em_elaboracao', 'Iniciar elaboração', ['responsavel', 'colaborador']),
    T('em_elaboracao', 'encaminhado', 'Encaminhar para revisão', ['responsavel'], { requireComplete: true }),
    T('correcao_solicitada', 'encaminhado', 'Reencaminhar após correções', ['responsavel'], { requireComplete: true }),
    T('encaminhado', 'em_analise', 'Receber para análise', ['gestor_unidade', 'analista_tecnico']),
    T('encaminhado', 'correcao_solicitada', 'Solicitar correção', ['gestor_unidade'], { requireNote: true }),
    T('em_analise', 'correcao_solicitada', 'Solicitar correção', ['gestor_unidade', 'analista_tecnico', 'gestor_financeiro'], {
      requireNote: true,
    }),
    T('em_analise', 'validado_tecnicamente', 'Validar tecnicamente', ['analista_tecnico'], { requireNote: true }),
    T('validado_tecnicamente', 'aguardando_decisao', 'Encaminhar para decisão', ['gestor_financeiro'], { requireNote: true }),
    T('validado_tecnicamente', 'correcao_solicitada', 'Solicitar correção', ['gestor_financeiro'], { requireNote: true }),
    T('aguardando_decisao', 'aprovado', 'Registrar aprovação', ['gestor_financeiro', 'administrador'], {
      requireNote: true,
      requireAdministrativeReference: true,
    }),
    T('aguardando_decisao', 'rejeitado', 'Registrar rejeição', ['gestor_financeiro', 'administrador'], {
      requireNote: true,
      requireAdministrativeReference: true,
    }),
    T('aprovado', 'em_execucao', 'Iniciar execução', ['responsavel', 'gestor_financeiro']),
    T('em_execucao', 'concluido', 'Registrar conclusão da execução', ['responsavel', 'gestor_unidade'], { requireNote: true }),
    T('concluido', 'prestacao_contas', 'Iniciar prestação de contas', ['responsavel']),
    T('prestacao_contas', 'encerrado', 'Registrar encerramento', ['gestor_financeiro'], {
      requireNote: true,
      requireAdministrativeReference: true,
    }),
  ],
}

/** Cores (classes Tailwind) por estado para badges. */
export const STATUS_TONE: Record<ProjectStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  rascunho: 'neutral',
  em_elaboracao: 'info',
  encaminhado: 'info',
  em_analise: 'warning',
  correcao_solicitada: 'danger',
  validado_tecnicamente: 'success',
  aguardando_decisao: 'warning',
  aprovado: 'success',
  rejeitado: 'danger',
  em_execucao: 'info',
  concluido: 'success',
  prestacao_contas: 'warning',
  encerrado: 'neutral',
}

export const ROLE_LABELS: Record<Role, string> = {
  proponente: 'Servidor proponente',
  gestor_unidade: 'Gestor de unidade',
  analista_tecnico: 'Analista técnico',
  gestor_financeiro: 'Gestor financeiro',
  administrador: 'Administrador',
}

export const ACTOR_LABELS: Record<Actor, string> = {
  ...ROLE_LABELS,
  responsavel: 'Responsável pelo projeto',
  colaborador: 'Colaborador do projeto',
}
