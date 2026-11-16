/**
 * Definição das etapas do assistente de elaboração de projetos.
 * Módulo compartilhado (servidor e cliente) — não importar código de servidor aqui.
 */

export const PROJECT_TYPES = [
  { value: 'manutencao_programas', label: 'Manutenção de programas finalísticos' },
  { value: 'aparelhamento', label: 'Aparelhamento e reaparelhamento institucional' },
  { value: 'equipamentos', label: 'Aquisição de equipamentos operacionais e tecnológicos' },
  { value: 'servicos', label: 'Contratação de serviços' },
  { value: 'construcao', label: 'Construção de unidade prisional' },
  { value: 'reforma_ampliacao', label: 'Reforma e ampliação de unidade prisional' },
  { value: 'material_permanente', label: 'Aquisição de material permanente' },
  { value: 'processamento_dados', label: 'Aquisição de material para processamento de dados' },
  { value: 'capacitacao', label: 'Capacitação e aperfeiçoamento de servidores' },
  { value: 'outros', label: 'Outro projeto compatível com as finalidades do FUNPES' },
] as const
export type ProjectTypeKey = (typeof PROJECT_TYPES)[number]['value']

export const THEMATIC_AREAS = [
  'Segurança e custódia',
  'Tecnologia da informação',
  'Infraestrutura prisional',
  'Saúde no sistema prisional',
  'Educação, trabalho e reintegração social',
  'Inteligência penitenciária',
  'Capacitação de servidores',
  'Gestão administrativa',
  'Outra',
] as const

export const BUDGET_CATEGORIES = [
  'Equipamento',
  'Material permanente',
  'Material de consumo',
  'Material de processamento de dados',
  'Serviço de terceiros — pessoa jurídica',
  'Obra / instalação',
  'Capacitação',
  'Outro',
] as const

export type FieldType = 'text' | 'textarea' | 'select'

export interface FieldDef {
  key: string
  label: string
  /** Pergunta em linguagem simples feita ao servidor. */
  question: string
  help?: string
  type: FieldType
  required: boolean
  maxLength: number
  options?: ReadonlyArray<{ value: string; label: string }>
}

export type StepKind = 'fields' | 'identification' | 'objectives' | 'budget' | 'schedule' | 'risks' | 'documents' | 'review'

export interface StepDef {
  number: number
  key: string
  title: string
  description: string
  kind: StepKind
  /** Seção (project_sections.section_key) onde os campos textuais são guardados. */
  section: string
  fields: FieldDef[]
}

const t = (
  key: string,
  label: string,
  question: string,
  opts: Partial<Pick<FieldDef, 'help' | 'required' | 'maxLength' | 'type'>> = {},
): FieldDef => ({
  key,
  label,
  question,
  help: opts.help,
  type: opts.type ?? 'textarea',
  required: opts.required ?? true,
  maxLength: opts.maxLength ?? 6000,
})

export const STEPS: StepDef[] = [
  {
    number: 1,
    key: 'identificacao',
    title: 'Identificação',
    description: 'Dados básicos do projeto: título, unidade, tipo, local e público beneficiário.',
    kind: 'identification',
    section: 'identificacao',
    fields: [
      t('title', 'Título do projeto', 'Como você chamaria este projeto em uma frase curta?', {
        type: 'text',
        maxLength: 200,
        help: 'Ex.: "Modernização do parque de informática da Unidade X".',
      }),
      {
        key: 'project_type',
        label: 'Tipo de projeto',
        question: 'Qual destas opções melhor descreve o que você pretende fazer?',
        type: 'select',
        required: true,
        maxLength: 60,
        options: PROJECT_TYPES,
      },
      {
        key: 'thematic_area',
        label: 'Área temática',
        question: 'Em qual área de atuação o projeto se encaixa?',
        type: 'select',
        required: true,
        maxLength: 120,
        options: THEMATIC_AREAS.map((a) => ({ value: a, label: a })),
      },
      t('location', 'Local de implementação', 'Onde o projeto será implementado (unidade, município, setor)?', {
        type: 'text',
        maxLength: 300,
      }),
      t('beneficiaries', 'Público beneficiário', 'Quem será beneficiado? Informe, se souber, quantos servidores ou pessoas.', {
        maxLength: 2000,
        help: 'Não informe nomes ou dados pessoais de custodiados.',
      }),
      t('responsavel_tecnico', 'Responsável técnico (cargo/função)', 'Qual cargo ou função responderá tecnicamente pelo projeto?', {
        type: 'text',
        required: false,
        maxLength: 200,
      }),
    ],
  },
  {
    number: 2,
    key: 'diagnostico',
    title: 'Diagnóstico',
    description: 'O problema que o projeto pretende resolver e a situação atual.',
    kind: 'fields',
    section: 'diagnostico',
    fields: [
      t('problema', 'Problema identificado', 'Qual problema você pretende resolver em sua unidade?'),
      t('situacao_atual', 'Situação atual', 'Como a situação está hoje? Descreva quantidades e condições que você conhece.'),
      t('evidencias', 'Evidências disponíveis', 'Que evidências comprovam o problema (relatórios, levantamentos, fotos, ocorrências)?', {
        help: 'Informe apenas evidências que realmente existem. Elas poderão ser anexadas na Etapa 9.',
      }),
      t('impactos', 'Impactos institucionais', 'Como esse problema afeta o trabalho da unidade e dos servidores?'),
      t('consequencias', 'Consequências da não implementação', 'O que acontece se nada for feito?'),
      t('necessidades', 'Necessidades prioritárias', 'O que é mais urgente resolver primeiro?', { required: false }),
    ],
  },
  {
    number: 3,
    key: 'justificativa',
    title: 'Justificativa',
    description: 'Por que o projeto é relevante e de interesse público.',
    kind: 'fields',
    section: 'justificativa',
    fields: [
      t('relevancia', 'Relevância institucional', 'Por que este projeto é importante para a Polícia Penal?'),
      t('interesse_publico', 'Interesse público', 'Como a sociedade se beneficia com este projeto?'),
      t('beneficios', 'Benefícios esperados', 'Quais melhorias concretas você espera depois da implementação?'),
      t('alinhamento', 'Alinhamento com a execução penal', 'Como o projeto contribui para os objetivos da execução penal (custódia, segurança, reintegração)?'),
      t('fundamentacao', 'Fundamentação técnica e normativa', 'Existe norma, plano ou estudo técnico que apoie o projeto? Cite apenas o que você conhece.', {
        required: false,
        help: 'A análise de enquadramento normativo é feita na Etapa 10 e depende de revisão humana.',
      }),
    ],
  },
  {
    number: 4,
    key: 'objetivos',
    title: 'Objetivos',
    description: 'Objetivo geral, objetivos específicos, resultados e indicadores mensuráveis.',
    kind: 'objectives',
    section: 'objetivos',
    fields: [
      t('objetivo_geral', 'Objetivo geral', 'Em uma frase: o que o projeto pretende alcançar?', { maxLength: 1500 }),
      t('resultados_esperados', 'Resultados esperados', 'Quais resultados poderão ser verificados ao final do projeto?'),
      t('metas', 'Metas', 'Quais metas quantificáveis e com prazo você propõe?', { required: false }),
    ],
  },
  {
    number: 5,
    key: 'solucao',
    title: 'Solução proposta',
    description: 'Como o problema será resolvido.',
    kind: 'fields',
    section: 'solucao',
    fields: [
      t('descricao', 'Descrição da intervenção', 'O que exatamente será feito, adquirido ou contratado?'),
      t('metodologia', 'Metodologia de execução', 'Como a execução será organizada (etapas, responsáveis, forma de contratação prevista)?'),
      t('especificacoes', 'Especificações preliminares', 'Quais características técnicas mínimas a solução deve ter?'),
      t('quantitativos', 'Quantitativos necessários', 'Quantas unidades ou qual volume é necessário, e como você chegou a esse número?'),
      t('alternativas', 'Alternativas consideradas', 'Que outras soluções foram consideradas e por que foram descartadas?', { required: false }),
      t('beneficios_operacionais', 'Benefícios operacionais', 'Que ganhos operacionais a solução trará no dia a dia?', { required: false }),
    ],
  },
  {
    number: 6,
    key: 'orcamento',
    title: 'Planejamento financeiro',
    description: 'Itens, quantidades, valores pesquisados, fontes e memória de cálculo.',
    kind: 'budget',
    section: 'orcamento',
    fields: [
      t('metodologia_precos', 'Metodologia da pesquisa de preços', 'Como os preços foram pesquisados (fontes, datas, critério adotado)?', {
        help: 'Os valores devem vir de pesquisas reais. A IA não fornece preços de mercado.',
      }),
    ],
  },
  {
    number: 7,
    key: 'cronograma',
    title: 'Cronograma',
    description: 'Atividades, responsáveis, prazos, marcos e desembolso previsto.',
    kind: 'schedule',
    section: 'cronograma',
    fields: [t('observacoes', 'Observações sobre o cronograma', 'Há condicionantes que podem afetar os prazos?', { required: false })],
  },
  {
    number: 8,
    key: 'riscos',
    title: 'Riscos',
    description: 'Riscos técnicos, financeiros e administrativos, com medidas de mitigação.',
    kind: 'risks',
    section: 'riscos',
    fields: [],
  },
  {
    number: 9,
    key: 'documentacao',
    title: 'Documentação',
    description: 'Anexos, estudos, levantamentos, cotações, evidências e declarações.',
    kind: 'documents',
    section: 'documentacao',
    fields: [],
  },
  {
    number: 10,
    key: 'revisao',
    title: 'Revisão e consolidação',
    description: 'Conferência, pendências, enquadramento preliminar e exportação.',
    kind: 'review',
    section: 'revisao',
    fields: [
      t('apresentacao', 'Apresentação', 'Como você apresentaria o projeto em um parágrafo para quem vai analisá-lo?'),
      t('conclusao', 'Conclusão', 'Qual a mensagem final do projeto para a autoridade competente?'),
    ],
  },
]

export const TOTAL_STEPS = STEPS.length

export function getStep(n: number): StepDef | undefined {
  return STEPS.find((s) => s.number === n)
}

/** Campos da Etapa 1 guardados em colunas da tabela projects. */
export const PROJECT_COLUMN_FIELDS = ['title', 'project_type', 'thematic_area', 'location', 'beneficiaries'] as const

export function projectTypeLabel(value: string | null | undefined): string {
  return PROJECT_TYPES.find((p) => p.value === value)?.label ?? 'Não informado'
}

/**
 * Documentos usualmente necessários por tipo de projeto.
 * São SUGESTÕES de instrução processual, a confirmar pela área técnica
 * e pelas normas vigentes — não constituem exigência normativa confirmada.
 */
export const SUGGESTED_DOCUMENTS: Record<string, string[]> = {
  _comum: [
    'Documento de formalização da demanda',
    'Evidências do problema (relatórios, levantamentos, registros)',
    'Pesquisa de preços com fontes identificadas e datadas',
  ],
  equipamentos: ['Levantamento do parque de equipamentos existente', 'Especificação técnica / termo de referência preliminar'],
  processamento_dados: ['Levantamento do parque de informática existente', 'Parecer da área de tecnologia da informação'],
  material_permanente: ['Especificação técnica dos bens', 'Previsão de local de guarda e responsável patrimonial'],
  aparelhamento: ['Levantamento das necessidades por unidade', 'Especificação técnica dos itens'],
  servicos: ['Termo de referência preliminar', 'Justificativa da necessidade de contratação'],
  construcao: [
    'Estudo técnico preliminar / projeto básico de engenharia',
    'Documentação do terreno',
    'Licenças e autorizações aplicáveis',
    'Orçamento de referência elaborado por profissional habilitado',
  ],
  reforma_ampliacao: [
    'Laudo ou vistoria técnica da edificação',
    'Projeto básico de engenharia',
    'Orçamento de referência elaborado por profissional habilitado',
  ],
  capacitacao: ['Plano de curso / conteúdo programático', 'Público-alvo e critérios de seleção', 'Justificativa de pertinência com as atribuições'],
  manutencao_programas: ['Descrição do programa finalístico e seus resultados anteriores'],
  outros: ['Demonstração da compatibilidade com as finalidades legais do FUNPES'],
}

export function suggestedDocumentsFor(projectType: string | null | undefined): string[] {
  return [...SUGGESTED_DOCUMENTS._comum, ...(SUGGESTED_DOCUMENTS[projectType ?? ''] ?? [])]
}

export const ACCOUNTABILITY_CHECKLIST = [
  'Notas fiscais e comprovantes de despesa',
  'Comprovantes de pagamento',
  'Termos de recebimento / atesto',
  'Registro patrimonial dos bens adquiridos (quando aplicável)',
  'Relatório de execução física',
  'Relatório de execução financeira',
  'Demonstrativo de cumprimento das metas e indicadores',
  'Registro fotográfico ou outras evidências de entrega',
]
