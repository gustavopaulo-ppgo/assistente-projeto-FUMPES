import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { analyzeFraming } from '@/features/legal/framing'
import { PermissionError, ValidationError } from '@/server/auth/permissions'
import { validateUpload, sanitizeFileName } from '@/server/files/validate'
import { safeCell } from '@/server/exports/xlsx'
import { winAnsi } from '@/server/exports/pdf'
import { MemoryFileStorage } from '@/server/storage/memory'
import { deleteDocument, getDocumentDownload, setDocumentStatus, uploadDocument } from '@/server/services/documents'
import { exportDocument } from '@/server/services/exports'
import { listLegalReferences, saveLegalReference, setLegalValidation } from '@/server/services/legal'
import { getBundleForUser } from '@/server/services/projects'
import { ctxFor, DEMO_IDS, freshStore } from './helpers'

const MB = 1024 * 1024
const pdfBytes = (body = '') => new TextEncoder().encode(`%PDF-1.4\n${body}\n%%EOF`)

describe('verificação de arquivos enviados', () => {
  it('aceita PDF, PNG e JPEG válidos', () => {
    expect(validateUpload('relatorio.pdf', pdfBytes('1 0 obj'), MB).ok).toBe(true)
    expect(validateUpload('foto.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), MB).ok).toBe(true)
    expect(validateUpload('foto.JPG', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]), MB).ok).toBe(true)
  })

  it('rejeita tipo não permitido, conteúdo falsificado, vazio e tamanho excessivo', () => {
    expect(validateUpload('virus.exe', new Uint8Array([0x4d, 0x5a]), MB)).toMatchObject({ ok: false })
    expect(validateUpload('falso.pdf', new TextEncoder().encode('<html><script>alert(1)</script>'), MB)).toMatchObject({ ok: false })
    expect(validateUpload('vazio.pdf', new Uint8Array(), MB)).toMatchObject({ ok: false })
    expect(validateUpload('grande.pdf', new Uint8Array(MB + 1), MB)).toMatchObject({ ok: false, reason: expect.stringMatching(/limite/) })
    expect(validateUpload('imagem.svg', new TextEncoder().encode('<svg onload=alert(1)>'), MB)).toMatchObject({ ok: false })
    expect(validateUpload('nota.exe.pdf', pdfBytes(), MB)).toMatchObject({ ok: false })
  })

  it('rejeita PDF com JavaScript e Office com macros', () => {
    expect(validateUpload('ativo.pdf', pdfBytes('/OpenAction << /S /JavaScript /JS (app.alert(1)) >>'), MB)).toMatchObject({ ok: false })
    const fakeDocm = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode('word/document.xml vbaProject.bin')])
    expect(validateUpload('macro.docx', fakeDocm, MB)).toMatchObject({ ok: false, reason: expect.stringMatching(/macros/) })
  })

  it('sanitiza nomes de arquivo (path traversal e caracteres de controle)', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('..\\..\\windows\\a\u0000b.pdf')).toBe('ab.pdf')
  })

  it('upload no serviço: valida permissão, registra hash e permite download apenas a quem vê o projeto', async () => {
    const store = freshStore()
    const storage = new MemoryFileStorage()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const doc = await uploadDocument(ana, storage, DEMO_IDS.projInformatica, { name: 'inventario.pdf', bytes: pdfBytes('x'), category: 'Levantamento', context: 'elaboracao' }, MB)
    expect(doc.sha256).toMatch(/^[a-f0-9]{64}$/)
    const dl = await getDocumentDownload(ana, storage, doc.id)
    expect(dl.bytes?.length).toBeGreaterThan(0)

    const fabio = await ctxFor(store, DEMO_IDS.fabio)
    await expect(getDocumentDownload(fabio, storage, doc.id)).rejects.toThrow(/não encontrado/)
    await expect(
      uploadDocument(fabio, storage, DEMO_IDS.projInformatica, { name: 'x.pdf', bytes: pdfBytes(), category: 'X', context: 'elaboracao' }, MB),
    ).rejects.toThrow()
    await expect(
      uploadDocument(ana, storage, DEMO_IDS.projInformatica, { name: 'x.html', bytes: new TextEncoder().encode('<b>'), category: 'X', context: 'elaboracao' }, MB),
    ).rejects.toBeInstanceOf(ValidationError)
    const rejected = await store.list('audit_logs', { where: { action: 'upload_rejeitado' } })
    expect(rejected).toHaveLength(1)

    // proponente não pode "conferir" o próprio documento
    await expect(setDocumentStatus(ana, doc.id, { status: 'conferido' })).rejects.toBeInstanceOf(PermissionError)
    await deleteDocument(ana, doc.id)
    expect((await store.get('project_documents', doc.id))?.deleted_at).toBeTruthy()
  })
})

describe('base normativa e enquadramento', () => {
  it('sem norma validada: informação normativa insuficiente', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const bundle = await getBundleForUser(ana, DEMO_IDS.projRaioX)
    const r = analyzeFraming(bundle, await listLegalReferences(ana))
    expect(r.classification).toBe('informacao_insuficiente')
    expect(r.basis).toEqual([])
    expect(r.provisions).toEqual([])
    expect(r.unverifiedReferences.length).toBeGreaterThan(0)
    expect(r.humanReviewRequired).toBe(true)
  })

  it('base normativa vazia não quebra a análise', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const bundle = await getBundleForUser(ana, DEMO_IDS.projRaioX)
    expect(analyzeFraming(bundle, []).classification).toBe('informacao_insuficiente')
  })

  it('somente administrador cadastra; norma só vale após validação humana com URL oficial', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const admin = await ctxFor(store, DEMO_IDS.admin)
    const input = {
      title: 'Norma de teste',
      number: 'Portaria Fictícia 1/2026',
      issuer: 'Órgão Fictício',
      official_url: '',
      rules: [{ project_types: ['equipamentos'], provision: 'art. 1º (fictício)', summary: 'Permite aquisição de equipamentos', effect: 'permite' as const, required_documents: ['Termo de referência'], restrictions: [] }],
    }
    await expect(saveLegalReference(ana, input)).rejects.toBeInstanceOf(PermissionError)
    const ref = await saveLegalReference(admin, input)
    expect(ref.validation_status).toBe('nao_verificada')
    await expect(setLegalValidation(admin, ref.id, 'verificada')).rejects.toBeInstanceOf(ValidationError)
    await saveLegalReference(admin, { ...input, id: ref.id, official_url: 'https://exemplo.gov.br/portaria' })
    await setLegalValidation(admin, ref.id, 'verificada')

    const bundle = await getBundleForUser(ana, DEMO_IDS.projRaioX)
    const r = analyzeFraming(bundle, await listLegalReferences(ana))
    expect(r.basis.map((b) => b.number)).toEqual(['Portaria Fictícia 1/2026'])
    expect(r.provisions[0]).toContain('art. 1º (fictício)')
    expect(r.requiredDocuments).toEqual([{ name: 'Termo de referência', present: false }])
    expect(r.classification).toBe('dependente_complementacao')

    // editar a norma volta a exigir validação
    await saveLegalReference(admin, { ...input, id: ref.id, official_url: 'https://exemplo.gov.br/portaria', title: 'Alterada' })
    const after = analyzeFraming(bundle, await listLegalReferences(ana))
    expect(after.classification).toBe('informacao_insuficiente')
  })

  it('regra restritiva validada indica possível incompatibilidade', async () => {
    const store = freshStore()
    const admin = await ctxFor(store, DEMO_IDS.admin)
    const ref = await saveLegalReference(admin, {
      title: 'Restrição fictícia',
      number: 'Norma X',
      issuer: 'Órgão',
      official_url: 'https://exemplo.gov.br/x',
      rules: [{ project_types: ['equipamentos'], provision: null, summary: 'Vedação fictícia', effect: 'restringe', required_documents: [], restrictions: [] }],
    })
    await setLegalValidation(admin, ref.id, 'verificada')
    const bundle = await getBundleForUser(admin, DEMO_IDS.projRaioX)
    expect(analyzeFraming(bundle, await listLegalReferences(admin)).classification).toBe('possivel_incompatibilidade')
  })
})

describe('geração de documentos', () => {
  it('gera PDF do projeto com assinatura válida e várias páginas', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const r = await exportDocument(ana, DEMO_IDS.projRaioX, 'projeto', 'pdf')
    expect(r.mime).toBe('application/pdf')
    expect(new TextDecoder().decode(r.bytes.slice(0, 5))).toBe('%PDF-')
    expect(r.bytes.length).toBeGreaterThan(5000)
    expect(r.filename).toBe('FUNPES-2026-0002-projeto.pdf')
  })

  it('gera DOCX editável contendo as seções do projeto', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const r = await exportDocument(ana, DEMO_IDS.projRaioX, 'projeto', 'docx')
    const zip = await JSZip.loadAsync(r.bytes)
    const xml = await zip.file('word/document.xml')!.async('string')
    for (const t of ['Diagnóstico', 'Justificativa', 'Orçamento', 'Cronograma', 'Riscos e Mitigação', 'Fundamentação Normativa', 'Conclusão', 'Anexos']) {
      expect(xml).toContain(t)
    }
    expect(xml).toContain('Informação normativa insuficiente')
  })

  it('gera planilha XLSX com fórmulas e totais corretos', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const r = await exportDocument(ana, DEMO_IDS.projRaioX, 'orcamento', 'xlsx')
    const zip = await JSZip.loadAsync(r.bytes)
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(sheet).toContain('<f>E5*F5</f>')
    expect(sheet).toContain('SUM(G5:G6)')
    expect(sheet).toContain('397000')
  })

  it('gera cronograma, relatório de pendências, checklist e relatório de execução', async () => {
    const store = freshStore()
    const ana = await ctxFor(store, DEMO_IDS.ana)
    const fabio = await ctxFor(store, DEMO_IDS.fabio)
    expect((await exportDocument(ana, DEMO_IDS.projRaioX, 'cronograma', 'xlsx')).bytes.length).toBeGreaterThan(1000)
    expect((await exportDocument(ana, DEMO_IDS.projInformatica, 'pendencias', 'pdf')).bytes.length).toBeGreaterThan(1000)
    expect((await exportDocument(ana, DEMO_IDS.projInformatica, 'checklist', 'docx')).bytes.length).toBeGreaterThan(1000)
    expect((await exportDocument(fabio, DEMO_IDS.projCapacitacao, 'execucao', 'pdf')).bytes.length).toBeGreaterThan(1000)
  })

  it('exportação respeita permissões e formatos', async () => {
    const store = freshStore()
    const fabio = await ctxFor(store, DEMO_IDS.fabio)
    await expect(exportDocument(fabio, DEMO_IDS.projRaioX, 'projeto', 'pdf')).rejects.toThrow(/não encontrado/)
    const ana = await ctxFor(store, DEMO_IDS.ana)
    await expect(exportDocument(ana, DEMO_IDS.projRaioX, 'projeto', 'exe')).rejects.toBeInstanceOf(ValidationError)
  })

  it('protege planilhas contra injeção de fórmulas e PDF contra caracteres não suportados', () => {
    expect(safeCell('=HYPERLINK("http://mal")')).toBe('\'=HYPERLINK("http://mal")')
    expect(safeCell('Monitor')).toBe('Monitor')
    expect(winAnsi('a ≠ b → c 😀 ação')).toBe('a != b -> c ? ação')
  })
})
