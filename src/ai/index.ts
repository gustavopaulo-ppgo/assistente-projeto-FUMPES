import { getStep } from '@/features/projects/steps'
import type { ProjectBundle } from '@/types/bundle'
import { SYSTEM_PROMPT, buildProjectContext } from './prompts'
import { localProvider } from './providers/local'
import { geminiProvider, openAiProvider } from './providers/remote'
import { introducesNewNumbers } from './sanitize'
import { assistantResponseSchema, type AiProvider, type AssistantResponse, type ValidatedSuggestion } from './types'

export interface AiConfig {
  provider: 'local' | 'gemini' | 'openai'
  model?: string
  externalAllowed: boolean
  geminiKey?: string
  openaiKey?: string
}

/**
 * Seleciona o provedor. Provedores externos exigem autorização explícita
 * (AI_EXTERNAL_ALLOWED=true) e chave configurada; caso contrário usa o local.
 */
export function selectProvider(cfg: AiConfig): { provider: AiProvider; notice: string | null } {
  if (cfg.provider === 'local') return { provider: localProvider, notice: null }
  if (!cfg.externalAllowed) {
    return { provider: localProvider, notice: 'Provedor externo de IA não autorizado (AI_EXTERNAL_ALLOWED=false). Usando o assistente local.' }
  }
  if (cfg.provider === 'gemini' && cfg.geminiKey) return { provider: geminiProvider(cfg.geminiKey, cfg.model), notice: null }
  if (cfg.provider === 'openai' && cfg.openaiKey) return { provider: openAiProvider(cfg.openaiKey, cfg.model), notice: null }
  return { provider: localProvider, notice: 'Chave do provedor de IA não configurada. Usando o assistente local.' }
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('Resposta sem JSON')
  return JSON.parse(trimmed.slice(start, end + 1))
}

const FORBIDDEN_OUTPUT = /(projeto\s+(est[áa]\s+)?aprovad|aprovo\s+o\s+projeto|despesa\s+aprovada|presta[çc][ãa]o\s+de\s+contas\s+aprovada|recurso\s+liberado)/i

export interface RunOutcome {
  response: AssistantResponse
  suggestions: ValidatedSuggestion[]
  raw: string | null
  error: string | null
}

/** Executa o assistente com timeout, valida a saída e filtra sugestões fora do escopo. */
export async function runAssistant(
  provider: AiProvider,
  bundle: ProjectBundle,
  stepNumber: number,
  userMessage: string,
  timeoutMs: number,
): Promise<RunOutcome> {
  const step = getStep(stepNumber)
  if (!step) throw new Error('Etapa inválida')
  const context = buildProjectContext(bundle, stepNumber, provider.external)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let raw: string
  try {
    raw = await Promise.race([
      provider.generate({ system: SYSTEM_PROMPT, context, userMessage, structured: { bundle, step: stepNumber } }, controller.signal),
      new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Tempo limite excedido ao consultar o assistente.')))),
    ])
  } catch (e) {
    return { response: emptyResponse(), suggestions: [], raw: null, error: (e as Error).message || 'Falha ao consultar o assistente.' }
  } finally {
    clearTimeout(timer)
  }

  let parsed: AssistantResponse
  try {
    const result = assistantResponseSchema.safeParse(extractJson(raw))
    if (!result.success) throw new Error('esquema')
    parsed = result.data
  } catch {
    return { response: emptyResponse(), suggestions: [], raw: raw.slice(0, 2000), error: 'A resposta do assistente não seguiu o formato esperado e foi descartada.' }
  }

  // Pós-filtro: somente campos da etapa atual; bloqueia conteúdo decisório; marca números novos.
  const allowed = new Map(step.fields.map((f) => [f.key, f]))
  const sources = `${context}\n${userMessage}`
  const alerts = [...parsed.alertas]
  const suggestions: ValidatedSuggestion[] = []
  for (const s of parsed.sugestoes) {
    const field = allowed.get(s.campo)
    if (!field) {
      alerts.push(`Sugestão para campo não permitido ("${s.campo.slice(0, 40)}") foi descartada.`)
      continue
    }
    if (FORBIDDEN_OUTPUT.test(s.texto)) {
      alerts.push('Uma sugestão continha linguagem de decisão administrativa e foi descartada. O assistente não aprova projetos nem despesas.')
      continue
    }
    const unconfirmed = introducesNewNumbers(s.texto, sources)
    suggestions.push({
      campo: s.campo,
      rotulo: field.label,
      texto: s.texto.slice(0, field.maxLength),
      explicacao: s.explicacao,
      contemDadosNaoConfirmados: unconfirmed,
    })
  }
  if (suggestions.some((s) => s.contemDadosNaoConfirmados)) {
    alerts.push('Há sugestão com números que não constam das informações fornecidas. Confirme cada valor antes de aplicar — o sistema não aceita dados inventados.')
  }
  const mensagem = FORBIDDEN_OUTPUT.test(parsed.mensagem)
    ? 'O assistente não emite decisões administrativas. Consulte as pendências e sugestões abaixo.'
    : parsed.mensagem
  return { response: { ...parsed, mensagem, alertas: alerts }, suggestions, raw: null, error: null }
}

function emptyResponse(): AssistantResponse {
  return { mensagem: '', perguntas: [], sugestoes: [], pendencias: [], alertas: [] }
}
