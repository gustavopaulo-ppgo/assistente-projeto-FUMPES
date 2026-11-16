import { evaluateCompleteness } from '@/features/projects/completeness'
import { projectTypeLabel } from '@/features/projects/steps'
import type { ProjectBundle } from '@/types/bundle'
import type { LegalReference } from '@/types/domain'

/**
 * Análise PRELIMINAR de enquadramento. Usa somente normas cadastradas e
 * VALIDADAS por responsável. Nunca é conclusiva: sempre exige análise humana.
 */

export type FramingClass = 'favoravel' | 'dependente_complementacao' | 'possivel_incompatibilidade' | 'informacao_insuficiente'

export const FRAMING_LABELS: Record<FramingClass, string> = {
  favoravel: 'Enquadramento preliminar favorável',
  dependente_complementacao: 'Enquadramento dependente de complementação',
  possivel_incompatibilidade: 'Possível incompatibilidade',
  informacao_insuficiente: 'Informação normativa insuficiente',
}

export interface FramingResult {
  classification: FramingClass
  label: string
  hypothesis: string
  basis: { id: string; number: string; title: string; official_url: string | null; last_verified_at: string | null }[]
  provisions: string[]
  restrictions: string[]
  requiredDocuments: { name: string; present: boolean }[]
  pendings: string[]
  unverifiedReferences: string[]
  humanReviewRequired: true
  disclaimer: string
}

const DISCLAIMER =
  'Resultado preliminar gerado a partir das regras cadastradas e validadas na base normativa do sistema. Não constitui parecer jurídico, não confirma vigência das normas e não substitui a análise jurídica e orçamentária competente.'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export function analyzeFraming(bundle: ProjectBundle, references: LegalReference[]): FramingResult {
  const type = bundle.project.project_type
  const active = references.filter((r) => !r.deleted_at)
  const verified = active.filter((r) => r.validation_status === 'verificada')
  const unverifiedReferences = active.filter((r) => r.validation_status !== 'verificada').map((r) => `${r.number} — ${r.title}`)

  const base = {
    humanReviewRequired: true as const,
    disclaimer: DISCLAIMER,
    unverifiedReferences,
  }

  if (!type) {
    return {
      ...base,
      classification: 'informacao_insuficiente',
      label: FRAMING_LABELS.informacao_insuficiente,
      hypothesis: 'O tipo de projeto não foi informado; não é possível formular hipótese de enquadramento.',
      basis: [],
      provisions: [],
      restrictions: [],
      requiredDocuments: [],
      pendings: ['Informe o tipo de projeto na Etapa 1.'],
    }
  }

  const applicable = verified.flatMap((ref) => ref.rules.filter((rule) => rule.project_types.includes(type)).map((rule) => ({ ref, rule })))

  if (applicable.length === 0) {
    return {
      ...base,
      classification: 'informacao_insuficiente',
      label: FRAMING_LABELS.informacao_insuficiente,
      hypothesis: `Não há regra normativa validada cadastrada para o tipo "${projectTypeLabel(type)}". O sistema não presume enquadramento sem suporte normativo confirmado.`,
      basis: [],
      provisions: [],
      restrictions: [],
      requiredDocuments: [],
      pendings: [
        'Solicitar ao administrador o cadastro e a validação das regras normativas aplicáveis a este tipo de projeto.',
        'Submeter o projeto à análise jurídica e orçamentária competente.',
      ],
    }
  }

  const basisMap = new Map(applicable.map(({ ref }) => [ref.id, ref]))
  const restrictions = applicable.filter(({ rule }) => rule.effect === 'restringe').flatMap(({ rule }) => [rule.summary, ...rule.restrictions])
  const otherRestrictions = applicable.filter(({ rule }) => rule.effect !== 'restringe').flatMap(({ rule }) => rule.restrictions)
  const provisions = applicable
    .filter(({ rule }) => rule.provision)
    .map(({ ref, rule }) => `${ref.number}, ${rule.provision} — ${rule.summary}`)

  const docNames = bundle.documents.filter((d) => !d.deleted_at).map((d) => norm(`${d.category} ${d.name}`))
  const requiredDocuments = [...new Set(applicable.flatMap(({ rule }) => rule.required_documents))].map((name) => ({
    name,
    present: docNames.some((d) => d.includes(norm(name))),
  }))

  const completeness = evaluateCompleteness(bundle)
  const pendings = [
    ...requiredDocuments.filter((d) => !d.present).map((d) => `Documento possivelmente exigido não identificado nos anexos: ${d.name}`),
    ...completeness.pendings.map((p) => `Etapa ${p.step}: ${p.message}`),
  ]

  let classification: FramingClass = 'favoravel'
  if (restrictions.length) classification = 'possivel_incompatibilidade'
  else if (pendings.length) classification = 'dependente_complementacao'

  const permits = applicable.filter(({ rule }) => rule.effect === 'permite')
  const hypothesis =
    classification === 'possivel_incompatibilidade'
      ? `Há regra(s) validada(s) que restringem projetos do tipo "${projectTypeLabel(type)}". Recomenda-se análise jurídica antes de prosseguir.`
      : permits.length
        ? `O tipo "${projectTypeLabel(type)}" encontra correspondência em regra(s) validada(s) da base normativa, sujeita à confirmação pela análise competente.`
        : `Existem regras validadas relacionadas ao tipo "${projectTypeLabel(type)}", mas nenhuma indica expressamente a finalidade; a análise humana deve confirmar o enquadramento.`
  if (classification === 'favoravel' && !permits.length) classification = 'dependente_complementacao'

  return {
    ...base,
    classification,
    label: FRAMING_LABELS[classification],
    hypothesis,
    basis: [...basisMap.values()].map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      official_url: r.official_url,
      last_verified_at: r.last_verified_at,
    })),
    provisions,
    restrictions: [...restrictions, ...otherRestrictions],
    requiredDocuments,
    pendings,
  }
}
