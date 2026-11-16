import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'demo-funpes'

async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail institucional').fill(email)
  await page.getByLabel('Senha').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/painel/)
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sair' }).first().click({ force: true })
  await expect(page).toHaveURL(/\/login/)
}

test('servidor cria projeto, usa o assistente, salva, retoma, orça, exporta; terceiros não acessam', async ({ page }) => {
  // 1. acesso
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('E-mail institucional').fill('ana.proponente@demo.funpes.local')
  await page.getByLabel('Senha').fill('senha-errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible()
  await login(page, 'ana.proponente@demo.funpes.local')
  await expect(page.getByText('Total de projetos')).toBeVisible()

  // 2. novo projeto
  await page.getByRole('link', { name: 'Novo projeto' }).first().click()
  await page.getByLabel('Título do projeto').fill('Projeto E2E de informática')
  await page.getByLabel('Unidade proponente').selectOption({ index: 1 })
  await page.getByLabel('O que você pretende fazer?').selectOption('processamento_dados')
  await page.getByRole('button', { name: 'Criar e iniciar o assistente' }).click()
  await expect(page).toHaveURL(/\/elaborar\/1$/)
  const projectUrl = page.url().replace(/\/elaborar\/1$/, '')

  // 3. etapa 1 → avançar (salva)
  await page.getByLabel('Local de implementação').fill('Setor administrativo')
  await page.getByRole('button', { name: 'Salvar e avançar' }).click()
  await expect(page).toHaveURL(/\/elaborar\/2$/)

  // 4. assistente de IA conduz o preenchimento
  await page.getByLabel('Mensagem ao assistente').fill('Precisamos adquirir equipamentos de informática porque os computadores estão velhos.')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText('Perguntas para completar')).toBeVisible()
  await expect(page.getByText(/Quantos equipamentos existem hoje/)).toBeVisible()
  await page.getByRole('button', { name: 'Inserir no campo' }).first().click()
  await expect(page.getByLabel('Problema identificado')).toHaveValue(/obsoletos/)
  await expect(page.getByText('Sugestão da IA — salve para confirmar')).toBeVisible()
  await page.getByLabel('Impactos institucionais').fill('Lentidão nas rotinas administrativas.')
  await page.getByRole('button', { name: 'Salvar e avançar' }).click()
  await expect(page).toHaveURL(/\/elaborar\/3$/)

  // 5. retorno sem perda de dados (dados recarregados do servidor)
  await page.getByRole('button', { name: /2\. Diagnóstico/ }).click()
  await expect(page).toHaveURL(/\/elaborar\/2$/)
  await page.reload()
  await expect(page.getByLabel('Problema identificado')).toHaveValue(/obsoletos/)
  await expect(page.getByLabel('Impactos institucionais')).toHaveValue('Lentidão nas rotinas administrativas.')
  await expect(page.getByText('Sugestão da IA aceita pelo servidor')).toBeVisible()

  // 6. orçamento com cálculo decimal
  await page.goto(`${projectUrl}/elaborar/6`)
  await page.getByRole('button', { name: 'Adicionar linha' }).click()
  await page.getByLabel('Descrição (linha 1)').fill('Microcomputador')
  await page.getByLabel('Qtd. (linha 1)').fill('3')
  await page.getByLabel('Preço unit. (R$) (linha 1)').fill('0,10')
  await page.getByLabel('Fonte da pesquisa (linha 1)').fill('Cotação fictícia de teste')
  await page.getByLabel('Data ref. (linha 1)').fill('2026-11-01')
  await expect(page.getByText('Total geral: R$ 0,30')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Tudo salvo')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Descrição (linha 1)')).toHaveValue('Microcomputador')

  // 7. exportação
  const pdf = await page.request.get(`${projectUrl.replace(/.*\/projetos\//, '/api/projetos/')}/exportar?doc=projeto&format=pdf`)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
  const xlsx = await page.request.get(`${projectUrl.replace(/.*\/projetos\//, '/api/projetos/')}/exportar?doc=orcamento&format=xlsx`)
  expect(xlsx.status()).toBe(200)

  // 8. encaminhamento bloqueado por pendências
  await page.goto(projectUrl)
  await page.getByRole('radio', { name: 'Encaminhar para revisão' }).click()
  await page.getByRole('button', { name: /Confirmar: Encaminhar/ }).click()
  await expect(page.getByText('pendências obrigatórias')).toBeVisible()

  // 9. acesso indevido por servidor de outra unidade
  await logout(page)
  await login(page, 'fabio.proponente@demo.funpes.local')
  await page.goto(projectUrl)
  await expect(page.getByText('Página ou registro não encontrado')).toBeVisible()
  const denied = await page.request.get(`${projectUrl.replace(/.*\/projetos\//, '/api/projetos/')}/exportar?doc=projeto&format=pdf`)
  expect(denied.status()).toBe(404)
  await page.goto('/admin/usuarios')
  await expect(page).toHaveURL(/\/painel/)
})

test('gestor financeiro acompanha execução e dashboard usa dados reais', async ({ page }) => {
  await login(page, 'elisa.financeiro@demo.funpes.local')
  await expect(page.getByText('Valores executados')).toBeVisible()
  await page.getByRole('link', { name: 'Projetos', exact: true }).click()
  await page.getByRole('link', { name: 'Capacitação em primeiros socorros para servidores' }).click()
  await page.getByRole('link', { name: 'Execução e prestação de contas' }).click()
  await expect(page.getByText('Previsto × executado por item')).toBeVisible()
  await expect(page.getByText('sem documento comprobatório vinculado')).toBeVisible()
})

test('requisição não autenticada à API é recusada', async ({ request }) => {
  const r = await request.get('/api/projetos/00000000-0000-4000-c000-000000000002/exportar?doc=projeto&format=pdf')
  expect(r.status()).toBe(401)
})
