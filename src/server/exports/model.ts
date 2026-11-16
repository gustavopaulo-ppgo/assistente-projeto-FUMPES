import { calculationMemory, formatBRL, formatDateBR, formatQty, summarizeBudget } from '@/features/budget/calc'
import { executionSummary } from '@/features/execution/summary'
import type { FramingResult } from '@/features/legal/framing'
import { evaluateCompleteness } from '@/features/projects/completeness'
import { STEPS, projectTypeLabel, suggestedDocumentsFor } from '@/features/projects/steps'
import { STATUS_LABELS } from '@/features/workflow/config'
import type { DocumentTemplate, InstitutionSettings } from '@/server/settings/defaults'
import type { ProjectBundle } from '@/types/bundle'

/** Modelo neutro de documento, renderizado em PDF e DOCX. */
export type Block =
  | { type: 'heading'; level: 1 | 2; text: string }
  | { type: 'paragraph'; text: string; italic?: boolean; label?: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][]; widths?: number[] }
  | { type: 'toc' }
  | { type: 'pagebreak' }

export interface DocModel {
  fileBase: string
  title: string
  cover: { title: string; subtitle: string; project: string; lines: string[]; draft: boolean }
  header: string
  footer: string
  logoDataUrl: string | null
  blocks: Block[]
}

const content = (b: ProjectBundle, section: string, key: string) => b.sections[section]?.content?.[key]?.trim() ?? ''
const orPending = (v: string | null | undefined) => (v && v.trim() ? v.trim() : '[PENDENTE — informação não fornecida]')
const RISK_CAT: Record<string, string> = { tecnico: 'Técnico', financeiro: 'Financeiro', administrativo: 'Administrativo', outro: 'Outro' }

function fileBase(b: ProjectBundle, kind: string) {
  return `${b.project.code}-${kind}`.replace(/[^A-Za-z0-9-]/g, '_')
}

function budgetTable(b: ProjectBundle): Block {
  const rows = b.budget.map((i, idx) => [
    String(idx + 1),
    i.description,
    i.category ?? '—',
    `${formatQty(i.quantity)} ${i.unit ?? ''}`.trim(),
    `R$ ${formatBRL(i.unit_price)}`,
    `R$ ${formatBRL(i.total)}`,
    `${i.source ?? 'não informada'}${i.reference_date ? ` (${formatDateBR(i.reference_date)})` : ''}`,
    i.expense_nature ? `${i.expense_nature}*` : '—',
  ])
  const total = summarizeBudget(b.budget).total
  rows.push(['', 'TOTAL GERAL', '', '', '', `R$ ${formatBRL(total)}`, '', ''])
  return {
    type: 'table',
    headers: ['#', 'Descrição', 'Categoria', 'Qtd.', 'Preço unit.', 'Total', 'Fonte / data', 'Natureza'],
    rows,
    widths: [4, 24, 12, 8, 11, 12, 20, 9],
  }
}

function scheduleTable(b: ProjectBundle): Block {
  const byId = new Map(b.schedule.map((s) => [s.id, s.activity]))
  return {
    type: 'table',
    headers: ['Atividade', 'Responsável', 'Início', 'Término', 'Marco', 'Depende de', 'Desembolso previsto'],
    rows: b.schedule.map((s) => [
      s.activity,
      s.responsible ?? '—',
      formatDateBR(s.start_date),
      formatDateBR(s.end_date),
      s.is_milestone ? 'Sim' : 'Não',
      s.depends_on ? (byId.get(s.depends_on) ?? '—') : '—',
      `R$ ${formatBRL(s.planned_amount)}`,
    ]),
    widths: [26, 16, 11, 11, 7, 15, 14],
  }
}

export function buildProjectDocument(
  b: ProjectBundle,
  template: DocumentTemplate,
  institution: InstitutionSettings,
  framing: FramingResult,
): DocModel {
  const T = (k: string) => template.section_titles[k] ?? k
  const intro = (k: string): Block[] => (template.section_intros[k] ? [{ type: 'paragraph', text: template.section_intros[k], italic: true }] : [])
  const completeness = evaluateCompleteness(b)
  const draft = completeness.pendings.length > 0 || !['aprovado', 'em_execucao', 'concluido', 'prestacao_contas', 'encerrado'].includes(b.project.status)
  const p = b.project
  const blocks: Block[] = [{ type: 'toc' }, { type: 'pagebreak' }]
  let n = 0
  const h = (key: string) => blocks.push({ type: 'heading', level: 1, text: `${++n}. ${T(key)}` }, ...intro(key))
  const field = (label: string, value: string) => blocks.push({ type: 'paragraph', label, text: orPending(value) })

  h('apresentacao')
  blocks.push({ type: 'paragraph', text: orPending(content(b, 'revisao', 'apresentacao')) })

  h('identificacao')
  blocks.push({
    type: 'table',
    headers: ['Campo', 'Informação'],
    rows: [
      ['Código', p.code],
      ['Título', p.title],
      ['Unidade proponente', b.unit ? `${b.unit.name} (${b.unit.acronym})` : '—'],
      ['Servidor responsável', b.owner?.full_name ?? '—'],
      ['Responsável técnico', content(b, 'identificacao', 'responsavel_tecnico') || '—'],
      ['Área temática', p.thematic_area ?? '—'],
      ['Tipo de projeto', projectTypeLabel(p.project_type)],
      ['Local de implementação', p.location ?? '—'],
      ['Situação no sistema', STATUS_LABELS[p.status]],
      ['Valor total estimado', `R$ ${formatBRL(p.requested_amount)}`],
    ],
    widths: [30, 70],
  })

  h('diagnostico')
  for (const f of STEPS[1].fields) field(f.label, content(b, 'diagnostico', f.key))

  h('justificativa')
  for (const f of STEPS[2].fields) field(f.label, content(b, 'justificativa', f.key))

  h('objetivos')
  field('Objetivo geral', content(b, 'objetivos', 'objetivo_geral'))
  blocks.push({ type: 'paragraph', label: 'Objetivos específicos', text: b.objectives.length ? '' : '[PENDENTE]' })
  if (b.objectives.length) blocks.push({ type: 'list', items: b.objectives.map((o) => `${o.description}${o.expected_result ? ` — resultado esperado: ${o.expected_result}` : ''}`) })
  field('Resultados esperados', content(b, 'objetivos', 'resultados_esperados'))
  if (content(b, 'objetivos', 'metas')) field('Metas', content(b, 'objetivos', 'metas'))
  blocks.push({ type: 'heading', level: 2, text: 'Indicadores de desempenho' })
  blocks.push(
    b.indicators.length
      ? {
          type: 'table',
          headers: ['Indicador', 'Fórmula', 'Linha de base', 'Meta', 'Unidade', 'Periodicidade', 'Fonte'],
          rows: b.indicators.map((i) => [i.name, i.formula ?? '—', i.baseline ?? '—', i.target ?? '—', i.unit ?? '—', i.frequency ?? '—', i.source ?? '—']),
          widths: [22, 18, 12, 12, 10, 12, 14],
        }
      : { type: 'paragraph', text: '[PENDENTE — nenhum indicador cadastrado]' },
  )

  h('metodologia')
  field('Metodologia de execução', content(b, 'solucao', 'metodologia'))

  h('solucao')
  for (const f of STEPS[4].fields.filter((x) => x.key !== 'metodologia')) {
    const v = content(b, 'solucao', f.key)
    if (f.required || v) field(f.label, v)
  }

  h('beneficiarios')
  blocks.push({ type: 'paragraph', text: orPending(p.beneficiaries) })

  h('orcamento')
  field('Metodologia da pesquisa de preços', content(b, 'orcamento', 'metodologia_precos'))
  blocks.push(budgetTable(b))
  blocks.push({ type: 'paragraph', italic: true, text: '* Natureza de despesa sugerida, sujeita a validação pela área orçamentária competente.' })
  const byCat = summarizeBudget(b.budget).byCategory
  if (byCat.length) {
    blocks.push({ type: 'heading', level: 2, text: 'Subtotais por categoria' })
    blocks.push({ type: 'table', headers: ['Categoria', 'Itens', 'Subtotal'], rows: byCat.map((c) => [c.category, String(c.count), `R$ ${formatBRL(c.subtotal)}`]), widths: [60, 15, 25] })
  }
  blocks.push({ type: 'heading', level: 2, text: 'Memória de cálculo' })
  blocks.push(b.budget.length ? { type: 'list', items: calculationMemory(b.budget) } : { type: 'paragraph', text: '[PENDENTE]' })

  h('cronograma')
  blocks.push(b.schedule.length ? scheduleTable(b) : { type: 'paragraph', text: '[PENDENTE — nenhuma atividade cadastrada]' })
  if (content(b, 'cronograma', 'observacoes')) field('Observações', content(b, 'cronograma', 'observacoes'))

  h('riscos')
  blocks.push(
    b.risks.length
      ? {
          type: 'table',
          headers: ['Categoria', 'Risco', 'Prob.', 'Impacto', 'Nível', 'Mitigação', 'Responsável'],
          rows: b.risks.map((r) => [RISK_CAT[r.category], r.description, String(r.probability), String(r.impact), String(r.probability * r.impact), r.mitigation ?? '—', r.owner ?? '—']),
          widths: [12, 26, 7, 8, 7, 26, 14],
        }
      : { type: 'paragraph', text: '[PENDENTE — nenhum risco identificado]' },
  )

  h('fundamentacao')
  if (content(b, 'justificativa', 'fundamentacao')) field('Fundamentação informada pelo proponente', content(b, 'justificativa', 'fundamentacao'))
  blocks.push({ type: 'paragraph', label: 'Análise preliminar de enquadramento', text: framing.label })
  blocks.push({ type: 'paragraph', label: 'Hipótese', text: framing.hypothesis })
  if (framing.basis.length) blocks.push({ type: 'paragraph', label: 'Base normativa validada utilizada', text: '' }, { type: 'list', items: framing.basis.map((x) => `${x.number} — ${x.title}${x.last_verified_at ? ` (verificada em ${formatDateBR(x.last_verified_at)})` : ''}`) })
  if (framing.provisions.length) blocks.push({ type: 'paragraph', label: 'Dispositivos confirmados', text: '' }, { type: 'list', items: framing.provisions })
  if (framing.restrictions.length) blocks.push({ type: 'paragraph', label: 'Restrições', text: '' }, { type: 'list', items: framing.restrictions })
  blocks.push({ type: 'paragraph', italic: true, text: framing.disclaimer })

  h('conclusao')
  blocks.push({ type: 'paragraph', text: orPending(content(b, 'revisao', 'conclusao')) })

  h('anexos')
  const docs = b.documents.filter((d) => !d.deleted_at && d.context === 'elaboracao')
  blocks.push(
    docs.length
      ? { type: 'table', headers: ['Categoria', 'Arquivo', 'Situação', 'Hash SHA-256 (início)'], rows: docs.map((d) => [d.category, d.name, d.status, d.sha256.slice(0, 16)]), widths: [25, 40, 15, 20] }
      : { type: 'paragraph', text: 'Nenhum anexo registrado.' },
  )
  blocks.push({ type: 'paragraph', italic: true, text: template.disclaimer })

  return {
    fileBase: fileBase(b, 'projeto'),
    title: p.title,
    cover: {
      title: template.cover_title,
      subtitle: template.cover_subtitle,
      project: p.title,
      lines: [
        institution.institution_name,
        b.unit?.name ?? '',
        `Código: ${p.code} — Versão ${p.version}`,
        `Situação no sistema: ${STATUS_LABELS[p.status]}`,
        `Emitido em ${formatDateBR(new Date().toISOString())}`,
      ].filter(Boolean),
      draft,
    },
    header: template.header_text || institution.institution_name,
    footer: template.footer_text,
    logoDataUrl: institution.logo_data_url,
    blocks,
  }
}

export function buildPendingReport(b: ProjectBundle, framing: FramingResult, institution: InstitutionSettings): DocModel {
  const c = evaluateCompleteness(b)
  const blocks: Block[] = [
    { type: 'heading', level: 1, text: 'Relatório de pendências' },
    { type: 'paragraph', label: 'Preenchimento', text: `${c.percent}% das verificações obrigatórias atendidas.` },
    { type: 'heading', level: 2, text: 'Pendências obrigatórias' },
    c.pendings.length
      ? { type: 'table', headers: ['Etapa', 'Pendência'], rows: c.pendings.map((x) => [`${x.step} — ${STEPS[x.step - 1].title}`, x.message]), widths: [30, 70] }
      : { type: 'paragraph', text: 'Nenhuma pendência obrigatória.' },
    { type: 'heading', level: 2, text: 'Inconsistências e alertas' },
    c.inconsistencies.length
      ? { type: 'table', headers: ['Etapa', 'Alerta'], rows: c.inconsistencies.map((x) => [`${x.step} — ${STEPS[x.step - 1].title}`, x.message]), widths: [30, 70] }
      : { type: 'paragraph', text: 'Nenhuma inconsistência detectada.' },
    { type: 'heading', level: 2, text: 'Enquadramento preliminar' },
    { type: 'paragraph', label: 'Classificação', text: framing.label },
    { type: 'list', items: framing.pendings.length ? framing.pendings : ['Sem pendências de enquadramento identificadas.'] },
    { type: 'paragraph', italic: true, text: framing.disclaimer },
  ]
  if (['em_execucao', 'concluido', 'prestacao_contas', 'encerrado'].includes(b.project.status)) {
    const ex = executionSummary(b)
    blocks.push({ type: 'heading', level: 2, text: 'Inconsistências da execução' }, { type: 'list', items: ex.inconsistencies.length ? ex.inconsistencies : ['Nenhuma.'] })
  }
  return simpleDoc(b, institution, 'pendencias', 'Relatório de pendências', blocks)
}

export function buildChecklistReport(b: ProjectBundle, framing: FramingResult, institution: InstitutionSettings): DocModel {
  const docs = b.documents.filter((d) => !d.deleted_at)
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const suggested = suggestedDocumentsFor(b.project.project_type)
  const rows = suggested.map((name) => {
    const found = docs.find((d) => norm(`${d.category} ${d.name}`).includes(norm(name).slice(0, 18)))
    return [name, found ? `${found.name} (${found.status})` : 'Não identificado', 'Sugestão do sistema']
  })
  for (const r of framing.requiredDocuments) rows.push([r.name, r.present ? 'Identificado' : 'Não identificado', 'Regra normativa validada'])
  const blocks: Block[] = [
    { type: 'heading', level: 1, text: 'Checklist documental' },
    { type: 'table', headers: ['Documento', 'Situação', 'Origem da exigência'], rows, widths: [50, 30, 20] },
    { type: 'heading', level: 2, text: 'Documentos anexados' },
    docs.length
      ? { type: 'table', headers: ['Fase', 'Categoria', 'Arquivo', 'Situação'], rows: docs.map((d) => [d.context, d.category, d.name, d.status]), widths: [18, 27, 35, 20] }
      : { type: 'paragraph', text: 'Nenhum documento anexado.' },
  ]
  if (b.accountability.length) {
    blocks.push(
      { type: 'heading', level: 2, text: 'Checklist de prestação de contas' },
      {
        type: 'table',
        headers: ['Item', 'Situação', 'Evidência', 'Observação'],
        rows: b.accountability.map((a) => [a.item, a.status, docs.find((d) => d.id === a.document_id)?.name ?? '—', a.note ?? '—']),
        widths: [40, 15, 25, 20],
      },
    )
  }
  blocks.push({ type: 'paragraph', italic: true, text: 'As sugestões documentais do sistema não constituem exigência normativa confirmada. Confirme com a área técnica e as normas vigentes.' })
  return simpleDoc(b, institution, 'checklist', 'Checklist documental', blocks)
}

export function buildExecutionReport(b: ProjectBundle, institution: InstitutionSettings): DocModel {
  const ex = executionSummary(b)
  const blocks: Block[] = [
    { type: 'heading', level: 1, text: 'Relatório de execução física e financeira' },
    {
      type: 'table',
      headers: ['Indicador', 'Valor'],
      rows: [
        ['Valor previsto (orçamento)', `R$ ${formatBRL(ex.planned)}`],
        ['Valor aprovado (registrado)', ex.approved ? `R$ ${formatBRL(ex.approved)}` : '—'],
        ['Executado (lançado, exceto rejeitadas)', `R$ ${formatBRL(ex.executed)}`],
        ['Executado conferido', `R$ ${formatBRL(ex.executedConfirmed)}`],
        ['Saldo', `R$ ${formatBRL(ex.balance)}`],
        ['Execução financeira', `${ex.financialPercent}%`],
        ['Execução física média', `${ex.physicalPercent}%`],
      ],
      widths: [60, 40],
    },
    { type: 'heading', level: 2, text: 'Previsto × executado por item' },
    { type: 'table', headers: ['Item', 'Previsto', 'Executado', 'Saldo', '%'], rows: ex.lines.map((l) => [l.description, `R$ ${formatBRL(l.planned)}`, `R$ ${formatBRL(l.executed)}`, `R$ ${formatBRL(l.balance)}`, `${l.percent}%`]), widths: [40, 16, 16, 16, 12] },
    { type: 'heading', level: 2, text: 'Metas e entregas' },
    b.deliverables.length
      ? { type: 'table', headers: ['Meta', 'Prevista', 'Entregue', 'Avanço', 'Situação'], rows: b.deliverables.map((d) => [d.goal, formatDateBR(d.planned_date), formatDateBR(d.delivered_date), `${d.physical_progress}%`, d.status]), widths: [40, 15, 15, 12, 18] }
      : { type: 'paragraph', text: 'Nenhuma meta/entrega registrada.' },
    { type: 'heading', level: 2, text: 'Despesas' },
    b.expenses.length
      ? { type: 'table', headers: ['Descrição', 'Fornecedor', 'NF/Comprovante', 'Emissão', 'Valor', 'Situação'], rows: b.expenses.filter((e) => !e.deleted_at).map((e) => [e.description, e.supplier ?? '—', e.invoice_number ?? '—', formatDateBR(e.issue_date), `R$ ${formatBRL(e.amount)}`, e.status]), widths: [26, 20, 14, 12, 14, 14] }
      : { type: 'paragraph', text: 'Nenhuma despesa lançada.' },
    { type: 'heading', level: 2, text: 'Indicadores' },
    b.indicators.length
      ? { type: 'table', headers: ['Indicador', 'Linha de base', 'Meta', 'Valor atual'], rows: b.indicators.map((i) => [i.name, i.baseline ?? '—', i.target ?? '—', i.current_value ?? '—']), widths: [40, 20, 20, 20] }
      : { type: 'paragraph', text: 'Nenhum indicador.' },
    { type: 'heading', level: 2, text: 'Inconsistências' },
    { type: 'list', items: ex.inconsistencies.length ? ex.inconsistencies : ['Nenhuma inconsistência detectada.'] },
    { type: 'paragraph', italic: true, text: 'Este relatório não declara a aprovação da prestação de contas, que depende de ato de autoridade competente e de evidência administrativa correspondente.' },
  ]
  return simpleDoc(b, institution, 'execucao', 'Relatório de execução', blocks)
}

function simpleDoc(b: ProjectBundle, institution: InstitutionSettings, kind: string, title: string, blocks: Block[]): DocModel {
  return {
    fileBase: fileBase(b, kind),
    title,
    cover: { title, subtitle: '', project: b.project.title, lines: [institution.institution_name, `Código: ${b.project.code}`, `Emitido em ${formatDateBR(new Date().toISOString())}`], draft: false },
    header: institution.institution_name,
    footer: `${b.project.code} — ${title}`,
    logoDataUrl: institution.logo_data_url,
    blocks,
  }
}
