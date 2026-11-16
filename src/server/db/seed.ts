import type { Tables } from './types'
import { DEFAULT_SETTINGS } from '@/server/settings/defaults'
import type {
  LegalReference,
  Project,
  ProjectBudgetItem,
  ProjectSection,
  ProjectStatus,
} from '@/types/domain'
import { itemTotal, sumDecimals } from '@/features/budget/calc'

/**
 * DADOS DEMONSTRATIVOS FICTÍCIOS.
 * Nenhum nome, valor, unidade ou cotação abaixo corresponde a dado real.
 */

export const DEMO_IDS = {
  unitA: '00000000-0000-4000-a000-0000000000a1',
  unitB: '00000000-0000-4000-a000-0000000000b2',
  unitC: '00000000-0000-4000-a000-0000000000c3',
  ana: '00000000-0000-4000-b000-000000000001', // proponente unidade A
  bruno: '00000000-0000-4000-b000-000000000002', // proponente unidade A (colaborador)
  carla: '00000000-0000-4000-b000-000000000003', // gestora unidade A
  diego: '00000000-0000-4000-b000-000000000004', // analista técnico (global)
  elisa: '00000000-0000-4000-b000-000000000005', // gestora financeira (global)
  admin: '00000000-0000-4000-b000-000000000006', // administrador
  fabio: '00000000-0000-4000-b000-000000000007', // proponente unidade B
  projInformatica: '00000000-0000-4000-c000-000000000001',
  projRaioX: '00000000-0000-4000-c000-000000000002',
  projCapacitacao: '00000000-0000-4000-c000-000000000003',
  projReforma: '00000000-0000-4000-c000-000000000004',
  fundFunpes: '00000000-0000-4000-d000-000000000001',
} as const

const NOW = '2026-10-01T12:00:00.000Z'
const FICT = '[DADO FICTÍCIO DE DEMONSTRAÇÃO]'

let seq = 0
const rid = (prefix: string) => {
  seq += 1
  return `00000000-0000-4000-e${prefix.padStart(3, '0').slice(0, 3)}-${String(seq).padStart(12, '0')}`
}

function section(project_id: string, key: string, content: Record<string, string>, by: string): ProjectSection {
  const field_meta = Object.fromEntries(
    Object.keys(content).map((k) => [k, { origin: 'servidor' as const, updated_at: NOW, updated_by: by }]),
  )
  return { id: rid('5'), project_id, section_key: key, content, field_meta, updated_by: by, updated_at: NOW }
}

function project(
  id: string,
  code: string,
  title: string,
  unit_id: string,
  owner_id: string,
  status: ProjectStatus,
  extra: Partial<Project>,
): Project {
  return {
    id,
    code,
    title,
    unit_id,
    owner_id,
    thematic_area: null,
    project_type: null,
    location: null,
    beneficiaries: null,
    status,
    current_step: 1,
    completion: 0,
    requested_amount: '0.00',
    approved_amount: null,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    ...extra,
  }
}

function budget(project_id: string, rows: [string, string, string, string, string, string][]): ProjectBudgetItem[] {
  return rows.map(([description, category, unit, quantity, unit_price, nature], i) => ({
    id: rid('6'),
    project_id,
    description,
    category,
    unit,
    quantity,
    unit_price,
    total: itemTotal(quantity, unit_price),
    source: `Cotação fictícia — Fornecedor Exemplo ${i + 1} Ltda ${FICT}`,
    reference_date: '2026-09-15',
    document_id: null,
    expense_nature: nature,
    justification: null,
    estimates: [],
    position: i,
  }))
}

const LEGAL_REFERENCES: Omit<LegalReference, 'id' | 'created_at'>[] = [
  {
    title: 'Lei Estadual que institui o Fundo Penitenciário Estadual — FUNPES',
    number: 'Lei Estadual nº 16.536/2009 (Goiás)',
    date: null,
    issuer: 'Estado de Goiás',
    official_url: null,
    text: null,
    version: null,
    last_verified_at: null,
    validation_status: 'nao_verificada',
    validated_by: null,
    categories: ['funpes', 'finalidades'],
    rules: [],
    deleted_at: null,
  },
  {
    title: 'Lei de Licitações e Contratos Administrativos',
    number: 'Lei Federal nº 14.133/2021',
    date: '2021-04-01',
    issuer: 'União',
    official_url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
    text: null,
    version: null,
    last_verified_at: null,
    validation_status: 'nao_verificada',
    validated_by: null,
    categories: ['contratacoes'],
    rules: [],
    deleted_at: null,
  },
  {
    title: 'Normas gerais de direito financeiro',
    number: 'Lei Federal nº 4.320/1964',
    date: '1964-03-17',
    issuer: 'União',
    official_url: 'https://www.planalto.gov.br/ccivil_03/leis/l4320.htm',
    text: null,
    version: null,
    last_verified_at: null,
    validation_status: 'nao_verificada',
    validated_by: null,
    categories: ['orcamento', 'natureza_despesa'],
    rules: [],
    deleted_at: null,
  },
  {
    title: 'Lei de Responsabilidade Fiscal',
    number: 'Lei Complementar nº 101/2000',
    date: '2000-05-04',
    issuer: 'União',
    official_url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm',
    text: null,
    version: null,
    last_verified_at: null,
    validation_status: 'nao_verificada',
    validated_by: null,
    categories: ['orcamento', 'responsabilidade_fiscal'],
    rules: [],
    deleted_at: null,
  },
  {
    title: 'Lei Geral de Proteção de Dados Pessoais',
    number: 'Lei Federal nº 13.709/2018',
    date: '2018-08-14',
    issuer: 'União',
    official_url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
    text: null,
    version: null,
    last_verified_at: null,
    validation_status: 'nao_verificada',
    validated_by: null,
    categories: ['lgpd'],
    rules: [],
    deleted_at: null,
  },
]

export function buildDemoSeed(): Partial<{ [K in keyof Tables]: Tables[K][] }> {
  seq = 0
  const I = DEMO_IDS
  const profile = (id: string, full_name: string, email: string, unit_id: string | null) => ({
    id,
    full_name,
    email,
    registration: `DEMO-${id.slice(-3)}`,
    unit_id,
    active: true,
    created_at: NOW,
  })
  const role = (user_id: string, r: Tables['user_roles']['role'], unit_id: string | null) => ({
    id: rid('2'),
    user_id,
    role: r,
    unit_id,
    created_at: NOW,
  })

  const pInfo = I.projInformatica
  const pRaio = I.projRaioX
  const pCap = I.projCapacitacao
  const pRef = I.projReforma

  const budgetInfo = budget(pInfo, [
    ['Microcomputador desktop (especificação preliminar)', 'Material de processamento de dados', 'unidade', '20', '4850.00', '4.4.90.52'],
    ['Monitor 24 polegadas', 'Material de processamento de dados', 'unidade', '20', '1120.50', '4.4.90.52'],
  ])
  const budgetRaio = budget(pRaio, [
    ['Equipamento de inspeção por raio-X para volumes', 'Equipamento', 'unidade', '1', '385000.00', '4.4.90.52'],
    ['Treinamento operacional do equipamento', 'Serviço de terceiros — pessoa jurídica', 'serviço', '1', '12000.00', '3.3.90.39'],
  ])
  const budgetCap = budget(pCap, [
    ['Curso de primeiros socorros (turma de 30 servidores)', 'Capacitação', 'turma', '4', '9800.00', '3.3.90.39'],
    ['Kit de material didático', 'Material de consumo', 'kit', '120', '45.90', '3.3.90.30'],
  ])
  const budgetRef = budget(pRef, [['Reforma do alojamento dos servidores (orçamento de referência)', 'Obra / instalação', 'serviço', '1', '248000.00', '4.4.90.51']])
  const sum = (items: ProjectBudgetItem[]) => sumDecimals(items.map((i) => i.total))

  const fullDiag = (problema: string) => ({
    problema,
    situacao_atual: `Situação descrita para fins de demonstração. ${FICT}`,
    evidencias: `Relatório interno fictício de levantamento. ${FICT}`,
    impactos: 'Atrasos nas rotinas administrativas e operacionais da unidade.',
    consequencias: 'Manutenção dos riscos operacionais e aumento de custos de manutenção corretiva.',
    necessidades: 'Substituição prioritária dos itens em pior estado.',
  })
  const fullJust = {
    relevancia: 'O projeto contribui para a melhoria das condições de trabalho e da segurança da unidade.',
    interesse_publico: 'Melhoria da eficiência do serviço público prestado pela unidade prisional.',
    beneficios: 'Redução do tempo de execução das rotinas e da indisponibilidade de equipamentos.',
    alinhamento: 'Apoia as atividades de custódia e de gestão da execução penal.',
    fundamentacao: '',
  }
  const fullSol = {
    descricao: 'Aquisição dos itens listados no planejamento financeiro.',
    metodologia: 'Instrução do processo de contratação pela unidade, com apoio da área técnica.',
    especificacoes: 'Especificações preliminares a serem detalhadas no termo de referência.',
    quantitativos: 'Quantitativos baseados no levantamento fictício da unidade.',
    alternativas: '',
    beneficios_operacionais: '',
  }

  return {
    organizational_units: [
      { id: I.unitA, name: 'Unidade Prisional Regional Fictícia Alfa', acronym: 'UPR-ALFA', city: 'Município Exemplo I', active: true, created_at: NOW, deleted_at: null },
      { id: I.unitB, name: 'Unidade Prisional Regional Fictícia Beta', acronym: 'UPR-BETA', city: 'Município Exemplo II', active: true, created_at: NOW, deleted_at: null },
      { id: I.unitC, name: 'Diretoria Administrativa Fictícia', acronym: 'DIR-ADM', city: 'Município Exemplo III', active: true, created_at: NOW, deleted_at: null },
    ],
    profiles: [
      profile(I.ana, 'Ana Proponente (fictícia)', 'ana.proponente@demo.funpes.local', I.unitA),
      profile(I.bruno, 'Bruno Colaborador (fictício)', 'bruno.colaborador@demo.funpes.local', I.unitA),
      profile(I.carla, 'Carla Gestora de Unidade (fictícia)', 'carla.gestora@demo.funpes.local', I.unitA),
      profile(I.diego, 'Diego Analista Técnico (fictício)', 'diego.analista@demo.funpes.local', I.unitC),
      profile(I.elisa, 'Elisa Gestora Financeira (fictícia)', 'elisa.financeiro@demo.funpes.local', I.unitC),
      profile(I.admin, 'Administrador do Sistema (fictício)', 'admin@demo.funpes.local', I.unitC),
      profile(I.fabio, 'Fábio Proponente (fictício)', 'fabio.proponente@demo.funpes.local', I.unitB),
    ],
    user_roles: [
      role(I.ana, 'proponente', I.unitA),
      role(I.bruno, 'proponente', I.unitA),
      role(I.carla, 'gestor_unidade', I.unitA),
      role(I.carla, 'proponente', I.unitA),
      role(I.diego, 'analista_tecnico', null),
      role(I.elisa, 'gestor_financeiro', null),
      role(I.admin, 'administrador', null),
      role(I.fabio, 'proponente', I.unitB),
    ],
    projects: [
      project(pInfo, 'FUNPES-2026-0001', 'Modernização do parque de informática da UPR Fictícia Alfa', I.unitA, I.ana, 'em_elaboracao', {
        thematic_area: 'Tecnologia da informação',
        project_type: 'processamento_dados',
        location: 'UPR Fictícia Alfa — setor administrativo',
        beneficiaries: 'Servidores do setor administrativo (quantitativo a confirmar).',
        current_step: 3,
        completion: 35,
        requested_amount: sum(budgetInfo),
      }),
      project(pRaio, 'FUNPES-2026-0002', 'Aquisição de equipamento de inspeção por raio-X', I.unitA, I.ana, 'em_analise', {
        thematic_area: 'Segurança e custódia',
        project_type: 'equipamentos',
        location: 'UPR Fictícia Alfa — portaria',
        beneficiaries: 'Servidores da portaria e visitantes da unidade.',
        current_step: 10,
        completion: 90,
        requested_amount: sum(budgetRaio),
      }),
      project(pCap, 'FUNPES-2026-0003', 'Capacitação em primeiros socorros para servidores', I.unitB, I.fabio, 'em_execucao', {
        thematic_area: 'Capacitação de servidores',
        project_type: 'capacitacao',
        location: 'UPR Fictícia Beta',
        beneficiaries: '120 servidores (quantitativo fictício).',
        current_step: 10,
        completion: 95,
        requested_amount: sum(budgetCap),
        approved_amount: sum(budgetCap),
      }),
      project(pRef, 'FUNPES-2026-0004', 'Reforma do alojamento dos servidores', I.unitA, I.carla, 'aprovado', {
        thematic_area: 'Infraestrutura prisional',
        project_type: 'reforma_ampliacao',
        location: 'UPR Fictícia Alfa — alojamento',
        beneficiaries: 'Servidores em regime de plantão.',
        current_step: 10,
        completion: 92,
        requested_amount: sum(budgetRef),
        approved_amount: sum(budgetRef),
      }),
    ],
    project_members: [
      { id: rid('3'), project_id: pInfo, user_id: I.bruno, member_role: 'colaborador', created_at: NOW },
    ],
    project_sections: [
      section(pInfo, 'identificacao', { responsavel_tecnico: 'Chefe do setor administrativo' }, I.ana),
      section(pInfo, 'diagnostico', {
        problema: 'Os computadores do setor administrativo estão ultrapassados e apresentam falhas frequentes.',
        situacao_atual: `Levantamento interno fictício aponta equipamentos com mais de 8 anos de uso. ${FICT}`,
        evidencias: '',
        impactos: 'Lentidão na elaboração de documentos e no acesso aos sistemas corporativos.',
        consequencias: '',
        necessidades: '',
      }, I.ana),
      section(pRaio, 'diagnostico', fullDiag('A inspeção de volumes na portaria é feita manualmente, com baixa efetividade.'), I.ana),
      section(pRaio, 'justificativa', fullJust, I.ana),
      section(pRaio, 'objetivos', { objetivo_geral: 'Aprimorar a inspeção de volumes na portaria da unidade.', resultados_esperados: 'Redução do tempo médio de inspeção.', metas: '' }, I.ana),
      section(pRaio, 'solucao', fullSol, I.ana),
      section(pRaio, 'orcamento', { metodologia_precos: `Pesquisa com três fornecedores fictícios. ${FICT}` }, I.ana),
      section(pRaio, 'revisao', { apresentacao: 'Projeto de demonstração.', conclusao: 'Recomenda-se a análise da proposta.' }, I.ana),
      section(pCap, 'diagnostico', fullDiag('Servidores sem capacitação recente em primeiros socorros.'), I.fabio),
      section(pCap, 'justificativa', fullJust, I.fabio),
      section(pCap, 'objetivos', { objetivo_geral: 'Capacitar servidores em primeiros socorros.', resultados_esperados: '120 servidores capacitados.', metas: '4 turmas em 6 meses.' }, I.fabio),
      section(pCap, 'solucao', { ...fullSol, descricao: 'Contratação de curso de primeiros socorros.' }, I.fabio),
      section(pRef, 'diagnostico', fullDiag('O alojamento apresenta infiltrações e instalações elétricas deterioradas.'), I.carla),
      section(pRef, 'justificativa', fullJust, I.carla),
      section(pRef, 'objetivos', { objetivo_geral: 'Recuperar as condições do alojamento.', resultados_esperados: 'Alojamento reformado.', metas: '' }, I.carla),
      section(pRef, 'solucao', { ...fullSol, descricao: 'Reforma do alojamento conforme projeto básico.' }, I.carla),
    ],
    project_objectives: [
      { id: rid('7'), project_id: pRaio, description: 'Instalar equipamento de inspeção na portaria', expected_result: 'Equipamento em operação', position: 0 },
      { id: rid('7'), project_id: pCap, description: 'Realizar 4 turmas de capacitação', expected_result: '120 servidores capacitados', position: 0 },
    ],
    project_indicators: [
      { id: rid('8'), project_id: pRaio, name: 'Tempo médio de inspeção por volume', formula: 'Tempo total / nº de volumes', baseline: 'A levantar', target: 'Redução de 30%', unit: 'minutos', frequency: 'Mensal', source: 'Registro da portaria', current_value: null, position: 0 },
      { id: rid('8'), project_id: pCap, name: 'Servidores capacitados', formula: 'Nº de concluintes', baseline: '0', target: '120', unit: 'servidores', frequency: 'Por turma', source: 'Listas de frequência', current_value: '60', position: 0 },
    ],
    project_budget_items: [...budgetInfo, ...budgetRaio, ...budgetCap, ...budgetRef],
    project_schedule: [
      { id: rid('9'), project_id: pRaio, activity: 'Instrução do processo de aquisição', responsible: 'Unidade proponente', start_date: '2027-01-10', end_date: '2027-03-10', is_milestone: false, depends_on: null, planned_amount: '0.00', position: 0 },
      { id: rid('9'), project_id: pRaio, activity: 'Entrega e instalação do equipamento', responsible: 'Fornecedor / unidade', start_date: '2027-04-01', end_date: '2027-05-15', is_milestone: true, depends_on: null, planned_amount: '397000.00', position: 1 },
      { id: rid('9'), project_id: pCap, activity: 'Turmas 1 e 2', responsible: 'Coordenação de capacitação', start_date: '2026-09-01', end_date: '2026-10-30', is_milestone: false, depends_on: null, planned_amount: '22263.60', position: 0 },
      { id: rid('9'), project_id: pCap, activity: 'Turmas 3 e 4', responsible: 'Coordenação de capacitação', start_date: '2026-11-03', end_date: '2026-12-18', is_milestone: true, depends_on: null, planned_amount: '22263.60', position: 1 },
    ],
    project_risks: [
      { id: rid('a'), project_id: pRaio, category: 'administrativo', description: 'Atraso na instrução do processo de contratação', probability: 3, impact: 3, mitigation: 'Acompanhamento quinzenal do processo', owner: 'Unidade proponente', position: 0 },
      { id: rid('a'), project_id: pRaio, category: 'tecnico', description: 'Incompatibilidade elétrica no local de instalação', probability: 2, impact: 4, mitigation: 'Vistoria técnica prévia', owner: 'Área de engenharia', position: 1 },
    ],
    project_approvals: [
      { id: rid('b'), project_id: pRaio, from_status: 'em_elaboracao', to_status: 'encaminhado', actor_id: I.ana, note: 'Projeto encaminhado para revisão.', administrative_reference: null, created_at: '2026-09-20T10:00:00.000Z' },
      { id: rid('b'), project_id: pRaio, from_status: 'encaminhado', to_status: 'em_analise', actor_id: I.carla, note: 'Recebido para análise.', administrative_reference: null, created_at: '2026-09-22T10:00:00.000Z' },
      { id: rid('b'), project_id: pCap, from_status: 'aguardando_decisao', to_status: 'aprovado', actor_id: I.elisa, note: 'Aprovação registrada (demonstração).', administrative_reference: `Processo SEI fictício 0000.0000/2026 ${FICT}`, created_at: '2026-08-01T10:00:00.000Z' },
      { id: rid('b'), project_id: pCap, from_status: 'aprovado', to_status: 'em_execucao', actor_id: I.fabio, note: null, administrative_reference: null, created_at: '2026-08-15T10:00:00.000Z' },
    ],
    project_reviews: [
      { id: rid('c'), project_id: pRaio, reviewer_id: I.carla, review_type: 'gestor_unidade', recommendation: 'favoravel', opinion: 'A demanda é pertinente à realidade da unidade (parecer fictício).', created_at: '2026-09-22T11:00:00.000Z' },
    ],
    project_deliverables: [
      { id: rid('d'), project_id: pCap, goal: 'Turmas 1 e 2 concluídas', description: '60 servidores capacitados', planned_date: '2026-10-30', delivered_date: '2026-10-28', physical_progress: 100, status: 'entregue', document_id: null, created_at: NOW },
      { id: rid('d'), project_id: pCap, goal: 'Turmas 3 e 4 concluídas', description: '60 servidores capacitados', planned_date: '2026-12-18', delivered_date: null, physical_progress: 10, status: 'em_andamento', document_id: null, created_at: NOW },
    ],
    project_expenses: [
      { id: rid('f'), project_id: pCap, budget_item_id: budgetCap[0].id, description: 'Pagamento turmas 1 e 2', supplier: 'Empresa Exemplo de Treinamentos Ltda (fictícia)', invoice_number: 'NF-FICT-0001', issue_date: '2026-10-29', payment_date: '2026-11-05', amount: '19600.00', status: 'lancada', document_id: null, created_by: I.fabio, created_at: NOW, deleted_at: null },
    ],
    accountability_records: [],
    legal_references: LEGAL_REFERENCES.map((r) => ({ ...r, id: rid('1'), created_at: NOW })),
    funding_sources: [
      { id: I.fundFunpes, name: 'Fundo Penitenciário Estadual — FUNPES', code: 'A CONFIRMAR', description: 'Código da fonte a ser confirmado pela área orçamentária.', active: true },
    ],
    project_funding_allocations: [
      { id: rid('0'), project_id: pCap, funding_source_id: I.fundFunpes, amount: sum(budgetCap), notes: FICT },
    ],
    system_settings: Object.entries(DEFAULT_SETTINGS).map(([id, value]) => ({ id, value, updated_at: NOW, updated_by: null })),
    audit_logs: [],
    ai_interactions: [],
    project_versions: [],
    project_documents: [],
  }
}
