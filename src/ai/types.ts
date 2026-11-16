import { z } from 'zod'
import type { ProjectBundle } from '@/types/bundle'

/** Resposta estruturada do assistente — SEMPRE validada antes do uso. */
export const assistantResponseSchema = z.object({
  mensagem: z.string().max(6000),
  perguntas: z.array(z.string().max(500)).max(8).default([]),
  sugestoes: z
    .array(
      z.object({
        campo: z.string().max(60),
        texto: z.string().max(6000),
        explicacao: z.string().max(1500).default(''),
      }),
    )
    .max(10)
    .default([]),
  pendencias: z.array(z.string().max(500)).max(20).default([]),
  alertas: z.array(z.string().max(500)).max(20).default([]),
})
export type AssistantResponse = z.infer<typeof assistantResponseSchema>

export interface ValidatedSuggestion {
  campo: string
  rotulo: string
  texto: string
  explicacao: string
  /** true quando o texto contém números/valores não presentes nas informações do servidor. */
  contemDadosNaoConfirmados: boolean
}

export interface AssistantResult {
  ok: boolean
  interactionId: string | null
  mensagem: string
  perguntas: string[]
  sugestoes: ValidatedSuggestion[]
  pendencias: string[]
  alertas: string[]
  provider: string
}

export interface AssistantRequest {
  /** Instruções centrais (não alteráveis por dados do usuário ou anexos). */
  system: string
  /** Dados do projeto, tratados como conteúdo NÃO confiável. */
  context: string
  /** Mensagem do servidor, tratada como conteúdo NÃO confiável. */
  userMessage: string
  /** Dados estruturados — usados apenas pelo provedor local (nunca enviados para fora). */
  structured: { bundle: ProjectBundle; step: number }
}

export interface AiProvider {
  readonly name: string
  readonly model: string
  readonly external: boolean
  /** Retorna texto JSON (será validado com assistantResponseSchema). */
  generate(req: AssistantRequest, signal: AbortSignal): Promise<string>
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiProviderError'
  }
}
