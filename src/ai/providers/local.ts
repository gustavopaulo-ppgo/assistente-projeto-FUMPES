import { summarizeBudget } from '@/features/budget/calc'
import { evaluateCompleteness, fieldValue } from '@/features/projects/completeness'
import { getStep, suggestedDocumentsFor } from '@/features/projects/steps'
import type { ProjectBundle } from '@/types/bundle'
import { detectInjection } from '../sanitize'
import type { AiProvider, AssistantRequest, AssistantResponse } from '../types'

/**
 * Assistente LOCAL determinístico (sem modelo de linguagem e sem envio de
 * dados para fora). Conduz o preenchimento por perguntas, reorganiza o texto
 * informado pelo servidor em linguagem institucional e aponta pendências.
 * Nunca acrescenta fatos, números ou fontes que não tenham sido informados.
 */

const THEMES: { match: RegExp; questions: string[] }[] = [
  {
    match: /computador|inform[áa]tica|notebook|monitor|impressora|rede|servidor de dados|sistema/i,
    questions: [
      'Quantos equipamentos existem hoje e há quanto tempo, aproximadamente, estão em uso?',
      'Existe laudo técnico, inventário ou levantamento do estado desses equipamentos?',
      'Quantos servidores utilizam esses equipamentos e em quais atividades?',
      'Quantos equipamentos novos são necessários e como você chegou a esse número?',
    ],
  },
  {
    match: /reforma|obra|constru|amplia|telhado|infiltra|el[ée]tric|hidr[áa]ulic|alojamento|cela|muro/i,
    questions: [
      'Existe laudo de vistoria ou relatório técnico de engenharia sobre a edificação?',
      'Qual a área aproximada (m²) e quais ambientes serão afetados?',
      'Há projeto básico ou orçamento de referência elaborado por profissional habilitado?',
      'A obra afetará a rotina de custódia? Como será a contingência durante a execução?',
    ],
  },
  {
    match: /capacita|curso|treinamento|forma[çc][ãa]o|qualifica/i,
    questions: [
      'Quantos servidores serão capacitados e com quais critérios de seleção?',
      'Qual a carga horária e o conteúdo previsto?',
      'Como a capacitação se relaciona com as atribuições desses servidores?',
    ],
  },
  {
    match: /ve[íi]culo|viatura|escolta|transporte/i,
    questions: [
      'Quantos veículos existem hoje, qual a idade e a quilometragem aproximada da frota?',
      'Quantas escoltas ou deslocamentos são realizados por mês (se houver registro)?',
    ],
  },
  {
    match: /raio.?x|scanner|detector|revista|inspe[çc][ãa]o|bloqueador|c[âa]mera|monitoramento|cftv/i,
    questions: [
      'Como a inspeção ou o monitoramento é feito hoje e quais falhas foram observadas?',
      'Há registros de ocorrências relacionadas (quantidade e período), sem dados pessoais?',
      'Onde exatamente o equipamento será instalado e há infraestrutura elétrica adequada?',
    ],
  },
]

/** Palavra inteira com suporte a letras acentuadas (\b do JS não reconhece "á", "ã" etc.). */
const word = (pattern: string) => new RegExp(`(?<!\\p{L})(?:${pattern})(?!\\p{L})`, 'giu')

const COLLOQUIAL: [RegExp, string][] = [
  [word('pra gente'), 'para a unidade'],
  [word('a gente'), 'a unidade'],
  [word('pra'), 'para'],
  [word('t[áa]'), 'está'],
  [word('t[ãa]o'), 'estão'],
  [word('precisamos'), 'faz-se necessário'],
  [word('muito ruim'), 'em condições inadequadas'],
  [word('muito velh[oa]s'), 'obsoletos'],
  [word('velh[oa]s?'), 'obsoletos'],
  [word('quebrad[oa]s?'), 'inoperantes'],
  [word('não funciona'), 'apresenta inoperância'],
]

/** Ajustes de registro linguístico — sem acrescentar informação. */
export function institutionalize(text: string): string {
  let t = text.trim().replace(/\s+/g, ' ')
  for (const [re, rep] of COLLOQUIAL) t = t.replace(re, rep)
  t = t.charAt(0).toUpperCase() + t.slice(1)
  if (!/[.!?]$/.test(t)) t += '.'
  return t
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const stripEnd = (s: string) => s.trim().replace(/[.!?;\s]+$/, '')

function themeQuestions(text: string): string[] {
  return THEMES.filter((t) => t.match.test(text)).flatMap((t) => t.questions)
}

function v(bundle: ProjectBundle, stepNumber: number, key: string) {
  return fieldValue(bundle, getStep(stepNumber)!, key)
}

export function localAssist(bundle: ProjectBundle, stepNumber: number, message: string): AssistantResponse {
  const step = getStep(stepNumber)!
  const completeness = evaluateCompleteness(bundle)
  const pendingHere = completeness.pendings.filter((p) => p.step === stepNumber)
  const res: AssistantResponse = { mensagem: '', perguntas: [], sugestoes: [], pendencias: [], alertas: [] }
  const msg = message.trim()

  if (msg && detectInjection(msg)) {
    res.alertas.push(
      'A mensagem contém instruções que tentam alterar as regras do assistente ou solicitar decisões administrativas. Esse conteúdo foi ignorado: o assistente não aprova projetos, não altera regras e não revela informações de terceiros.',
    )
  }

  const empty = step.fields.filter((f) => !fieldValue(bundle, step, f.key).trim())
  const firstEmpty = empty[0]

  // 1) Interpretação da resposta do servidor: rascunho do primeiro campo vazio.
  if (msg && !detectInjection(msg) && firstEmpty && step.kind !== 'budget') {
    res.sugestoes.push({
      campo: firstEmpty.key,
      texto: institutionalize(msg),
      explicacao: 'Texto informado por você, ajustado para linguagem institucional. Nenhuma informação foi acrescentada — revise antes de aplicar.',
    })
  }

  // 2) Composições a partir de dados já informados em outras etapas.
  const problema = v(bundle, 2, 'problema')
  const impactos = v(bundle, 2, 'impactos')
  const consequencias = v(bundle, 2, 'consequencias')
  const unitName = bundle.unit?.name ?? 'unidade proponente'
  const has = (k: string) => fieldValue(bundle, step, k).trim().length > 0
  const suggestIfEmpty = (campo: string, texto: string, explicacao: string) => {
    if (!has(campo) && !res.sugestoes.some((s) => s.campo === campo)) res.sugestoes.push({ campo, texto, explicacao })
  }

  if (stepNumber === 3 && problema) {
    suggestIfEmpty(
      'relevancia',
      `A proposta mostra-se relevante por enfrentar a seguinte situação identificada no diagnóstico: ${lowerFirst(stripEnd(problema))}.${impactos ? ` Conforme relatado, ${lowerFirst(stripEnd(impactos))}.` : ''}`,
      'Redação composta apenas a partir do diagnóstico (Etapa 2).',
    )
    if (consequencias) {
      suggestIfEmpty(
        'interesse_publico',
        `O interesse público evidencia-se pela necessidade de evitar as seguintes consequências da não implementação: ${lowerFirst(stripEnd(consequencias))}.`,
        'Baseado nas consequências informadas na Etapa 2.',
      )
    }
  }
  if (stepNumber === 4 && problema) {
    suggestIfEmpty(
      'objetivo_geral',
      `Solucionar ou mitigar, no âmbito da ${unitName}, a situação-problema identificada: ${lowerFirst(stripEnd(problema))}.`,
      'Objetivo geral derivado do problema descrito na Etapa 2. Ajuste o verbo e o alcance conforme a sua realidade.',
    )
    if (bundle.indicators.length === 0) {
      res.perguntas.push(
        'Como você vai comprovar que o projeto deu certo? Pense em algo que possa ser contado ou medido antes e depois (ex.: tempo de atendimento, quantidade de falhas, número de servidores atendidos).',
        'Qual é o valor atual desse indicador (linha de base)? Se não souber, ele precisará ser levantado.',
      )
      res.pendencias.push('Cadastre ao menos um indicador com linha de base e meta (a linha de base deve ser levantada, não estimada pela IA).')
    }
  }
  if (stepNumber === 10) {
    const objetivo = v(bundle, 4, 'objetivo_geral')
    if (objetivo) {
      suggestIfEmpty(
        'apresentacao',
        `O presente projeto, intitulado "${bundle.project.title}", é proposto pela ${unitName} e tem como objetivo geral: ${lowerFirst(stripEnd(objetivo))}.`,
        'Apresentação composta a partir do título, da unidade e do objetivo geral já informados.',
      )
    }
    res.alertas.push(
      'Enquadramento: consulte o painel de análise preliminar nesta etapa. Ele usa apenas normas validadas na base normativa e não substitui a análise jurídica e orçamentária competente.',
    )
  }

  // 3) Perguntas guiadas: campos vazios + perguntas temáticas.
  for (const f of empty.slice(firstEmpty && res.sugestoes.some((s) => s.campo === firstEmpty.key) ? 1 : 0, 3)) res.perguntas.push(f.question)
  if (stepNumber <= 5) {
    const themeSource = `${bundle.project.title} ${problema} ${msg}`
    const tq = themeQuestions(themeSource).filter((q) => !res.perguntas.includes(q))
    res.perguntas.push(...tq.slice(0, 3))
  }

  // 4) Etapas tabulares.
  if (step.kind === 'budget') {
    const s = summarizeBudget(bundle.budget)
    res.alertas.push('O assistente não fornece preços de mercado. Use somente valores de pesquisas reais, com fonte e data identificadas.')
    for (const i of s.issues.slice(0, 8)) res.pendencias.push(`Item ${i.itemIndex + 1}: ${i.message}`)
    if (!bundle.budget.length) res.perguntas.push('Quais itens ou serviços precisam ser adquiridos? Liste um por linha, com quantidade e unidade.')
    res.perguntas.push('Você possui ao menos três orçamentos ou pesquisas de preço para cada item? Anexe-os na Etapa 9.')
  }
  if (step.kind === 'schedule' && !bundle.schedule.length) {
    res.perguntas.push('Quais são as principais atividades até a entrega final (ex.: instrução do processo, contratação, entrega, instalação, treinamento)?')
  }
  if (step.kind === 'risks' && !bundle.risks.length) {
    res.perguntas.push(
      'O que pode atrasar ou impedir o projeto? Pense em riscos técnicos (instalação, compatibilidade), financeiros (variação de preços) e administrativos (prazos de contratação).',
    )
  }
  if (step.kind === 'documents') {
    const docs = suggestedDocumentsFor(bundle.project.project_type)
    res.mensagem = `Documentos usualmente úteis para este tipo de projeto (sugestão a confirmar com a área técnica e as normas vigentes): ${docs.join('; ')}.`
  }

  for (const p of pendingHere) if (!res.pendencias.includes(p.message)) res.pendencias.push(p.message)
  for (const inc of completeness.inconsistencies.filter((i) => i.step === stepNumber)) res.alertas.push(inc.message)

  if (!res.mensagem) {
    res.mensagem = res.sugestoes.length
      ? 'Preparei sugestões de redação com base apenas no que você informou. Revise cada uma e clique em "Inserir no campo" se concordar; nada é gravado sem a sua confirmação.'
      : pendingHere.length
        ? `Ainda faltam ${pendingHere.length} informação(ões) obrigatória(s) nesta etapa. Responda às perguntas abaixo com o que você sabe — eu ajudo a organizar o texto.`
        : 'Esta etapa está com os campos obrigatórios preenchidos. Você pode pedir uma revisão de texto descrevendo o que deseja melhorar ou seguir para a próxima etapa.'
  }
  res.perguntas = [...new Set(res.perguntas)].slice(0, 6)
  return res
}

export const localProvider: AiProvider = {
  name: 'local',
  model: 'assistente-regras-v1',
  external: false,
  async generate(req: AssistantRequest) {
    return JSON.stringify(localAssist(req.structured.bundle, req.structured.step, req.userMessage))
  },
}
