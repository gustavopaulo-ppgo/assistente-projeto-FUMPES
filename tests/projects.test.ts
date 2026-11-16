import { describe, expect, it } from 'vitest'
import {
  createProject,
  getBundleForUser,
  listVisibleProjects,
  saveStep,
  saveTableRows,
  transitionProject,
} from '@/server/services/projects'
import { NotFoundError, PermissionError, ValidationError } from '@/server/auth/permissions'
import { evaluateCompleteness } from '@/features/projects/completeness'
import { ctxFor, DEMO_IDS, freshStore } from './helpers'
import type { Ctx } from '@/server/services/common'

/** Preenche todas as etapas obrigatórias de um projeto novo. */
export async function buildCompleteProject(ana: Ctx) {
  const p = await createProject(ana, { title: 'Completo', unit_id: DEMO_IDS.unitA, project_type: 'equipamentos', thematic_area: 'Segurança e custódia' })
  await saveStep(ana, p.id, 1, { values: { location: 'Portaria', beneficiaries: '40 servidores' } })
  await saveStep(ana, p.id, 2, { values: { problema: 'a', situacao_atual: 'b', evidencias: 'c', impactos: 'd', consequencias: 'e' } })
  await saveStep(ana, p.id, 3, { values: { relevancia: 'a', interesse_publico: 'b', beneficios: 'c', alinhamento: 'd' } })
  await saveStep(ana, p.id, 4, { values: { objetivo_geral: 'a', resultados_esperados: 'b' } })
  await saveTableRows(ana, p.id, 'objectives', [{ description: 'Obj 1' }])
  await saveTableRows(ana, p.id, 'indicators', [{ name: 'Ind 1', baseline: '0', target: '10' }])
  await saveStep(ana, p.id, 5, { values: { descricao: 'a', metodologia: 'b', especificacoes: 'c', quantitativos: 'd' } })
  await saveStep(ana, p.id, 6, { values: { metodologia_precos: 'Três cotações' } })
  await saveTableRows(ana, p.id, 'budget', [
    { description: 'Item', unit: 'un', quantity: '1', unit_price: '100', source: 'Cotação', reference_date: new Date().toISOString().slice(0, 10) },
  ])
  await saveTableRows(ana, p.id, 'schedule', [{ activity: 'A', start_date: '2027-01-01', end_date: '2027-02-01', is_milestone: true, planned_amount: '100' }])
  await saveTableRows(ana, p.id, 'risks', [{ category: 'tecnico', description: 'R', probability: 2, impact: 2 }])
  await saveStep(ana, p.id, 10, { values: { apresentacao: 'a', conclusao: 'b' } })
  await ana.store.insert('project_documents', {
    id: crypto.randomUUID(),
    project_id: p.id,
    context: 'elaboracao',
    category: 'Evidência',
    name: 'x.pdf',
    storage_path: 'x',
    mime_type: 'application/pdf',
    size_bytes: 10,
    sha256: 'x',
    status: 'apresentado',
    review_note: null,
    uploaded_by: DEMO_IDS.ana,
    created_at: new Date().toISOString(),
    deleted_at: null,
  })
  return p
}

describe('cadastro, salvamento e recuperação de projeto', () => {
  it('servidor proponente cria projeto em rascunho e vira responsável', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const p = await createProject(ana, { title: 'Projeto de teste', unit_id: DEMO_IDS.unitA, project_type: 'equipamentos' })
    expect(p.status).toBe('rascunho')
    expect(p.code).toMatch(/^FUNPES-\d{4}-\d{4}$/)
    const bundle = await getBundleForUser(ana, p.id)
    expect(bundle.members.find((m) => m.user_id === DEMO_IDS.ana)?.member_role).toBe('responsavel')
    const audit = await store.list('audit_logs', { where: { project_id: p.id, action: 'criar' } })
    expect(audit).toHaveLength(1)
  })

  it('rejeita criação para unidade alheia e dados inválidos', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    await expect(createProject(ana, { title: 'X', unit_id: DEMO_IDS.unitB, project_type: 'equipamentos' })).rejects.toBeInstanceOf(PermissionError)
    await expect(createProject(ana, { title: '', unit_id: DEMO_IDS.unitA, project_type: 'equipamentos' })).rejects.toBeInstanceOf(ValidationError)
    await expect(createProject(ana, { title: 'Ok', unit_id: DEMO_IDS.unitA, project_type: 'invalido' })).rejects.toBeInstanceOf(ValidationError)
  })

  it('analista técnico (sem papel de proponente) não cria projetos', async () => {
    const store = freshStore()
    const diego = await ctxFor(store, DEMO_IDS.diego)
    await expect(createProject(diego, { title: 'X', unit_id: DEMO_IDS.unitA, project_type: 'equipamentos' })).rejects.toBeInstanceOf(PermissionError)
  })

  it('salva uma etapa, recupera os dados e registra a origem do conteúdo', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const p = await createProject(ana, { title: 'Projeto', unit_id: DEMO_IDS.unitA, project_type: 'equipamentos' })
    await saveStep(ana, p.id, 2, {
      values: { problema: 'Computadores ultrapassados', situacao_atual: 'Situação descrita' },
      aiAcceptedFields: ['situacao_atual'],
      nextStep: 3,
    })
    const bundle = await getBundleForUser(ana, p.id)
    expect(bundle.project.status).toBe('em_elaboracao')
    expect(bundle.project.current_step).toBe(3)
    expect(bundle.sections.diagnostico.content.problema).toBe('Computadores ultrapassados')
    expect(bundle.sections.diagnostico.field_meta.problema.origin).toBe('servidor')
    expect(bundle.sections.diagnostico.field_meta.situacao_atual.origin).toBe('ia_aceita')
    expect(bundle.project.completion).toBeGreaterThan(0)
  })

  it('navegar entre etapas não perde dados de etapas anteriores', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const p = await createProject(ana, { title: 'Projeto', unit_id: DEMO_IDS.unitA, project_type: 'equipamentos' })
    await saveStep(ana, p.id, 1, { values: { title: 'Novo título', location: 'Portaria' }, nextStep: 2 })
    await saveStep(ana, p.id, 2, { values: { problema: 'P1' }, nextStep: 3 })
    await saveStep(ana, p.id, 3, { values: { relevancia: 'R' }, nextStep: 2 })
    await saveStep(ana, p.id, 2, { values: { impactos: 'I' }, nextStep: 1 })
    const b = await getBundleForUser(ana, p.id)
    expect(b.project.title).toBe('Novo título')
    expect(b.project.location).toBe('Portaria')
    expect(b.sections.diagnostico.content).toMatchObject({ problema: 'P1', impactos: 'I' })
    expect(b.sections.justificativa.content.relevancia).toBe('R')
    expect(b.project.current_step).toBe(1)
  })

  it('valida campos: rejeita campos desconhecidos, opções inválidas e excesso de tamanho', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const p = await createProject(ana, { title: 'Projeto', unit_id: DEMO_IDS.unitA, project_type: 'equipamentos' })
    await expect(saveStep(ana, p.id, 2, { values: { campo_inexistente: 'x' } })).rejects.toBeInstanceOf(ValidationError)
    await expect(saveStep(ana, p.id, 1, { values: { project_type: 'hackeado' } })).rejects.toBeInstanceOf(ValidationError)
    await expect(saveStep(ana, p.id, 2, { values: { problema: 'x'.repeat(7000) } })).rejects.toBeInstanceOf(ValidationError)
    await expect(saveStep(ana, p.id, 99, { values: {} })).rejects.toBeInstanceOf(ValidationError)
  })

  it('orçamento: total é recalculado no servidor, ignorando o total enviado pelo cliente', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const p = await createProject(ana, { title: 'Projeto', unit_id: DEMO_IDS.unitA, project_type: 'equipamentos' })
    const updated = await saveTableRows(ana, p.id, 'budget', [
      { description: 'Item A', unit: 'un', quantity: '3', unit_price: '0,10', total: '999999', source: 'Cotação', reference_date: '2026-10-01' },
      { description: 'Item B', unit: 'un', quantity: '1,5', unit_price: '1.234,56', source: 'Cotação', reference_date: '2026-10-01' },
    ])
    const items = await store.list('project_budget_items', { where: { project_id: p.id }, orderBy: { column: 'position' } })
    expect(items.map((i) => i.total)).toEqual(['0.30', '1851.84'])
    expect(updated.requested_amount).toBe('1852.14')
  })

  it('cronograma: remapeia dependências entre linhas novas e remove linhas excluídas', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const p = await createProject(ana, { title: 'Projeto', unit_id: DEMO_IDS.unitA, project_type: 'equipamentos' })
    const tmpA = '11111111-1111-4111-8111-111111111111'
    await saveTableRows(ana, p.id, 'schedule', [
      { id: tmpA, activity: 'A', start_date: '2027-01-01', end_date: '2027-01-31', is_milestone: false, planned_amount: '0' },
      { activity: 'B', start_date: '2027-02-01', end_date: '2027-02-28', is_milestone: true, depends_on: tmpA, planned_amount: '10' },
    ])
    let rows = await store.list('project_schedule', { where: { project_id: p.id }, orderBy: { column: 'position' } })
    expect(rows).toHaveLength(2)
    expect(rows[1].depends_on).toBe(rows[0].id)
    await saveTableRows(ana, p.id, 'schedule', [{ ...rows[1], depends_on: null }])
    rows = await store.list('project_schedule', { where: { project_id: p.id } })
    expect(rows).toHaveLength(1)
    await expect(
      saveTableRows(ana, p.id, 'schedule', [{ activity: 'C', start_date: '2027-03-10', end_date: '2027-03-01', is_milestone: false, planned_amount: '0' }]),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('controle de acesso', () => {
  it('proponente de outra unidade não vê nem edita projeto alheio', async () => {
    const store = freshStore()
    const fabio = await ctxFor(store, DEMO_IDS.fabio)
    await expect(getBundleForUser(fabio, DEMO_IDS.projInformatica)).rejects.toBeInstanceOf(NotFoundError)
    await expect(saveStep(fabio, DEMO_IDS.projInformatica, 2, { values: { problema: 'invasão' } })).rejects.toBeInstanceOf(NotFoundError)
    const visible = await listVisibleProjects(fabio)
    expect(visible.map((p) => p.id)).toEqual([DEMO_IDS.projCapacitacao])
    const denied = await store.list('audit_logs', { where: { action: 'acesso_negado' } })
    expect(denied.length).toBeGreaterThan(0)
  })

  it('colaborador edita; gestor de unidade visualiza mas não edita', async () => {
    const store = freshStore()
    const bruno = await ctxFor(store, DEMO_IDS.bruno)
    await saveStep(bruno, DEMO_IDS.projInformatica, 2, { values: { evidencias: 'Planilha de inventário' } })
    const carla = await ctxFor(store, DEMO_IDS.carla)
    const b = await getBundleForUser(carla, DEMO_IDS.projInformatica)
    expect(b.sections.diagnostico.content.evidencias).toBe('Planilha de inventário')
    await expect(saveStep(carla, DEMO_IDS.projInformatica, 2, { values: { problema: 'x' } })).rejects.toBeInstanceOf(PermissionError)
  })

  it('analista técnico não vê projetos ainda em elaboração', async () => {
    const store = freshStore()
    const diego = await ctxFor(store, DEMO_IDS.diego)
    await expect(getBundleForUser(diego, DEMO_IDS.projInformatica)).rejects.toBeInstanceOf(NotFoundError)
    await expect(getBundleForUser(diego, DEMO_IDS.projRaioX)).resolves.toBeTruthy()
  })

  it('projeto em análise não pode ser editado nem pelo responsável', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    await expect(saveStep(ana, DEMO_IDS.projRaioX, 2, { values: { problema: 'alterado' } })).rejects.toBeInstanceOf(PermissionError)
    await expect(saveTableRows(ana, DEMO_IDS.projRaioX, 'risks', [])).rejects.toBeInstanceOf(PermissionError)
  })

  it('usuário inativo perde acesso', async () => {
    const store = freshStore()
    await store.update('profiles', DEMO_IDS.ana, { active: false })
    await expect(ctxFor(store, DEMO_IDS.ana)).rejects.toThrow()
  })

  it('identificador malformado (tentativa de injeção) é tratado como não encontrado', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    await expect(getBundleForUser(ana, "1' OR '1'='1")).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('fluxo de estados', () => {
  it('bloqueia encaminhamento com pendências obrigatórias', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const err = await transitionProject(ana, DEMO_IDS.projInformatica, { to: 'encaminhado' }).catch((e) => e)
    expect(err).toBeInstanceOf(ValidationError)
    expect((err as ValidationError).details.length).toBeGreaterThan(0)
  })

  it('bloqueia transição não autorizada e a registra em auditoria', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    await expect(transitionProject(ana, DEMO_IDS.projRaioX, { to: 'validado_tecnicamente', note: 'ok' })).rejects.toBeInstanceOf(PermissionError)
    await expect(
      transitionProject(ana, DEMO_IDS.projRaioX, { to: 'aprovado', note: 'ok', administrative_reference: 'x' }),
    ).rejects.toBeInstanceOf(PermissionError)
    const logs = await store.list('audit_logs', { where: { action: 'transicao_negada' } })
    expect(logs).toHaveLength(2)
  })

  it('segregação de funções: gestora não analisa o próprio projeto', async () => {
    const store = freshStore()
    const carla = await ctxFor(store, DEMO_IDS.carla)
    const p = await buildCompleteProject(carla)
    await transitionProject(carla, p.id, { to: 'encaminhado' })
    await expect(transitionProject(carla, p.id, { to: 'em_analise' })).rejects.toBeInstanceOf(PermissionError)
  })

  it('fluxo de análise até aprovação exige justificativa e referência administrativa', async () => {
    const store = freshStore()
    const diego = await ctxFor(store, DEMO_IDS.diego)
    const elisa = await ctxFor(store, DEMO_IDS.elisa)
    await expect(transitionProject(diego, DEMO_IDS.projRaioX, { to: 'validado_tecnicamente' })).rejects.toBeInstanceOf(ValidationError)
    await transitionProject(diego, DEMO_IDS.projRaioX, { to: 'validado_tecnicamente', note: 'Requisitos técnicos atendidos' })
    await transitionProject(elisa, DEMO_IDS.projRaioX, { to: 'aguardando_decisao', note: 'Orçamento conferido' })
    await expect(transitionProject(elisa, DEMO_IDS.projRaioX, { to: 'aprovado', note: 'Aprovado' })).rejects.toBeInstanceOf(ValidationError)
    const p = await transitionProject(elisa, DEMO_IDS.projRaioX, {
      to: 'aprovado',
      note: 'Aprovado',
      administrative_reference: 'Processo 123/2026',
    })
    expect(p.status).toBe('aprovado')
    expect(p.approved_amount).toBe(p.requested_amount)
    const hist = await store.list('project_approvals', { where: { project_id: DEMO_IDS.projRaioX }, orderBy: { column: 'created_at' } })
    expect(hist.at(-1)).toMatchObject({ from_status: 'aguardando_decisao', to_status: 'aprovado', actor_id: DEMO_IDS.elisa })
    const versions = await store.list('project_versions', { where: { project_id: DEMO_IDS.projRaioX } })
    expect(versions.length).toBe(1)
  })

  it('projeto completo pode ser encaminhado pelo responsável', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const p = await buildCompleteProject(ana)
    const bundle = await getBundleForUser(ana, p.id)
    const c = evaluateCompleteness(bundle)
    expect(c.pendings).toEqual([])
    expect(c.percent).toBe(100)
    const sent = await transitionProject(ana, p.id, { to: 'encaminhado' })
    expect(sent.status).toBe('encaminhado')
  })
})
