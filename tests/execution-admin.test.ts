import { describe, expect, it } from 'vitest'
import { executionSummary } from '@/features/execution/summary'
import { DEFAULT_WORKFLOW } from '@/features/workflow/config'
import { PermissionError, ValidationError } from '@/server/auth/permissions'
import { MemoryFileStorage } from '@/server/storage/memory'
import { applyRetention, listUsers, saveUser, updateSetting } from '@/server/services/admin'
import { getDashboard } from '@/server/services/dashboard'
import { uploadDocument } from '@/server/services/documents'
import {
  ensureAccountabilityChecklist,
  linkAccountabilityDocument,
  reviewAccountabilityItem,
  reviewExpense,
  saveDeliverable,
  saveExpense,
} from '@/server/services/execution'
import { getBundleForUser, transitionProject } from '@/server/services/projects'
import { addReview } from '@/server/services/reviews'
import { ctxFor, DEMO_IDS, freshStore } from './helpers'

const pdf = new TextEncoder().encode('%PDF-1.4\nnota fiscal\n%%EOF')

describe('execução e prestação de contas', () => {
  it('lança despesa, compara previsto × executado e detecta inconsistências', async () => {
    const store = freshStore()
    const fabio = await ctxFor(store, DEMO_IDS.fabio)
    const before = executionSummary(await getBundleForUser(fabio, DEMO_IDS.projCapacitacao))
    expect(before.executed).toBe('19600.00')
    expect(before.inconsistencies.some((i) => i.includes('sem documento comprobatório'))).toBe(true)

    const bundle = await getBundleForUser(fabio, DEMO_IDS.projCapacitacao)
    const kit = bundle.budget.find((b) => b.description.startsWith('Kit'))!
    await saveExpense(fabio, DEMO_IDS.projCapacitacao, { description: 'Kits', budget_item_id: kit.id, amount: '99999,99', invoice_number: 'NF-2', issue_date: '2026-11-01' })
    const after = executionSummary(await getBundleForUser(fabio, DEMO_IDS.projCapacitacao))
    expect(after.inconsistencies.some((i) => i.includes('superam o valor previsto'))).toBe(true)
    expect(after.inconsistencies.some((i) => i.includes('supera o valor aprovado'))).toBe(true)
  })

  it('registra entregas com evidência e exige data de entrega', async () => {
    const store = freshStore()
    const fabio = await ctxFor(store, DEMO_IDS.fabio)
    await expect(saveDeliverable(fabio, DEMO_IDS.projCapacitacao, { goal: 'Meta', physical_progress: 100, status: 'entregue' })).rejects.toBeInstanceOf(ValidationError)
    await saveDeliverable(fabio, DEMO_IDS.projCapacitacao, { goal: 'Meta', physical_progress: 100, status: 'entregue', delivered_date: '2026-11-10' })
    const b = await getBundleForUser(fabio, DEMO_IDS.projCapacitacao)
    expect(b.deliverables).toHaveLength(3)
  })

  it('lançamentos de execução bloqueados fora da fase de execução e para terceiros', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    await expect(saveExpense(ana, DEMO_IDS.projInformatica, { description: 'x', amount: '1' })).rejects.toBeInstanceOf(PermissionError)
    await expect(saveExpense(ana, DEMO_IDS.projCapacitacao, { description: 'x', amount: '1' })).rejects.toThrow(/não encontrado/)
  })

  it('evidências vinculadas à prestação de contas; conferência somente por gestor financeiro e com evidência', async () => {
    const store = freshStore()
    const storage = new MemoryFileStorage()
    const fabio = await ctxFor(store, DEMO_IDS.fabio)
    const elisa = await ctxFor(store, DEMO_IDS.elisa)
    await ensureAccountabilityChecklist(fabio, DEMO_IDS.projCapacitacao)
    let b = await getBundleForUser(fabio, DEMO_IDS.projCapacitacao)
    expect(b.accountability.length).toBeGreaterThan(5)
    const item = b.accountability[0]

    await expect(reviewAccountabilityItem(elisa, item.id, { status: 'conferido' })).rejects.toBeInstanceOf(ValidationError)
    const doc = await uploadDocument(fabio, storage, DEMO_IDS.projCapacitacao, { name: 'nf.pdf', bytes: pdf, category: 'Nota fiscal', context: 'prestacao_contas' }, 1e6)
    await linkAccountabilityDocument(fabio, DEMO_IDS.projCapacitacao, item.id, doc.id)
    await expect(reviewAccountabilityItem(fabio, item.id, { status: 'conferido' })).rejects.toBeInstanceOf(PermissionError)
    await expect(reviewAccountabilityItem(elisa, item.id, { status: 'rejeitado' })).rejects.toBeInstanceOf(ValidationError)
    await reviewAccountabilityItem(elisa, item.id, { status: 'conferido' })
    b = await getBundleForUser(fabio, DEMO_IDS.projCapacitacao)
    expect(b.accountability.find((a) => a.id === item.id)).toMatchObject({ status: 'conferido', reviewer_id: DEMO_IDS.elisa })

    const expense = b.expenses[0]
    await expect(reviewExpense(elisa, expense.id, { status: 'conferida' })).rejects.toBeInstanceOf(ValidationError)
    await saveExpense(fabio, DEMO_IDS.projCapacitacao, { ...expense, document_id: doc.id })
    await expect(reviewExpense(fabio, expense.id, { status: 'conferida' })).rejects.toBeInstanceOf(PermissionError)
    await reviewExpense(elisa, expense.id, { status: 'conferida' })
    await expect(saveExpense(fabio, DEMO_IDS.projCapacitacao, { ...expense, amount: '1' })).rejects.toThrow(/conferida/)
  })

  it('encerramento exige referência administrativa e ator autorizado', async () => {
    const store = freshStore()
    const fabio = await ctxFor(store, DEMO_IDS.fabio)
    const elisa = await ctxFor(store, DEMO_IDS.elisa)
    await transitionProject(fabio, DEMO_IDS.projCapacitacao, { to: 'concluido', note: 'Todas as turmas realizadas' })
    await transitionProject(fabio, DEMO_IDS.projCapacitacao, { to: 'prestacao_contas' })
    await expect(transitionProject(fabio, DEMO_IDS.projCapacitacao, { to: 'encerrado', note: 'x', administrative_reference: 'y' })).rejects.toBeInstanceOf(PermissionError)
    await expect(transitionProject(elisa, DEMO_IDS.projCapacitacao, { to: 'encerrado', note: 'Contas aprovadas' })).rejects.toBeInstanceOf(ValidationError)
    const p = await transitionProject(elisa, DEMO_IDS.projCapacitacao, { to: 'encerrado', note: 'Contas aprovadas', administrative_reference: 'Processo fictício 99/2026' })
    expect(p.status).toBe('encerrado')
  })
})

describe('pareceres', () => {
  it('somente papéis de análise registram pareceres e nunca no próprio projeto', async () => {
    const store = freshStore()
    const diego = await ctxFor(store, DEMO_IDS.diego)
    const ana = await ctxFor(store, DEMO_IDS.ana)
    await addReview(diego, DEMO_IDS.projRaioX, { review_type: 'tecnica', recommendation: 'favoravel', opinion: 'Requisitos atendidos' })
    await expect(addReview(diego, DEMO_IDS.projRaioX, { review_type: 'financeira', recommendation: 'favoravel', opinion: 'x' })).rejects.toBeInstanceOf(PermissionError)
    await expect(addReview(ana, DEMO_IDS.projRaioX, { review_type: 'tecnica', recommendation: 'favoravel', opinion: 'x' })).rejects.toBeInstanceOf(PermissionError)
  })
})

describe('dashboard', () => {
  it('administrador vê todos os projetos; proponente vê apenas os seus', async () => {
    const store = freshStore()
    const admin = await getDashboard(await ctxFor(store, DEMO_IDS.admin), {})
    expect(admin.total).toBe(4)
    expect(admin.execucao).toBe(1)
    expect(admin.valorExecutado).toBe('19600.00')
    const fabio = await getDashboard(await ctxFor(store, DEMO_IDS.fabio), {})
    expect(fabio.total).toBe(1)
    expect(fabio.valorSolicitado).toBe('44708.00')
  })

  it('aplica filtros de unidade, situação e período', async () => {
    const store = freshStore()
    const ctx = await ctxFor(store, DEMO_IDS.admin)
    expect((await getDashboard(ctx, { unit_id: DEMO_IDS.unitB })).total).toBe(1)
    expect((await getDashboard(ctx, { status: 'em_analise' })).total).toBe(1)
    expect((await getDashboard(ctx, { from: '2030-01-01' })).total).toBe(0)
    expect((await getDashboard(ctx, { project_type: 'capacitacao' })).total).toBe(1)
  })

  it('aponta prazos críticos vencidos ou próximos', async () => {
    const store = freshStore()
    const d = await getDashboard(await ctxFor(store, DEMO_IDS.admin), {}, new Date('2026-12-10T12:00:00Z'))
    expect(d.prazosCriticos.some((p) => p.label.includes('Turmas 3 e 4'))).toBe(true)
  })
})

describe('administração', () => {
  it('apenas administrador gerencia usuários e configurações', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const admin = await ctxFor(store, DEMO_IDS.admin)
    await expect(listUsers(ana)).rejects.toBeInstanceOf(PermissionError)
    await expect(updateSetting(ana, 'institution', {})).rejects.toBeInstanceOf(PermissionError)
    const id = await saveUser(admin, { full_name: 'Novo Servidor', email: 'Novo@Demo.local', unit_id: DEMO_IDS.unitA, active: true, roles: [{ role: 'proponente', unit_id: DEMO_IDS.unitA }] })
    const users = await listUsers(admin)
    expect(users.find((u) => u.id === id)).toMatchObject({ email: 'novo@demo.local', roles: [expect.objectContaining({ role: 'proponente' })] })
    await expect(saveUser(admin, { id: DEMO_IDS.admin, full_name: 'Adm', email: 'admin@demo.funpes.local', unit_id: null, active: true, roles: [] })).rejects.toBeInstanceOf(ValidationError)
  })

  it('fluxo configurável não permite remover exigência de evidência administrativa nem autoaprovação', async () => {
    const store = freshStore()
    const admin = await ctxFor(store, DEMO_IDS.admin)
    const unsafe = structuredClone(DEFAULT_WORKFLOW)
    unsafe.transitions.find((t) => t.to === 'aprovado')!.requireAdministrativeReference = false
    await expect(updateSetting(admin, 'workflow', unsafe)).rejects.toBeInstanceOf(ValidationError)
    const self = structuredClone(DEFAULT_WORKFLOW)
    self.transitions.find((t) => t.to === 'validado_tecnicamente')!.actors.push('responsavel')
    await expect(updateSetting(admin, 'workflow', self)).rejects.toBeInstanceOf(ValidationError)
    const renamed = structuredClone(DEFAULT_WORKFLOW)
    renamed.transitions[0].label = 'Começar a elaborar'
    await updateSetting(admin, 'workflow', renamed)
  })

  it('aplica política de retenção', async () => {
    const store = freshStore()
    const admin = await ctxFor(store, DEMO_IDS.admin)
    await store.insert('ai_interactions', {
      id: crypto.randomUUID(), project_id: DEMO_IDS.projInformatica, user_id: DEMO_IDS.ana, step: 2, user_message: 'antiga', provider: 'local', model: 'x',
      response: {}, status: 'sugerida', accepted_fields: [], created_at: '2020-01-01T00:00:00.000Z',
    })
    const r = await applyRetention(admin)
    expect(r.ai).toBe(1)
  })
})
