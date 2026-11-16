# AGENTS.md — Regras permanentes do projeto

Estas regras valem para qualquer pessoa ou agente de IA que altere este repositório.

## 1. Arquitetura

- **Next.js 16 (App Router) + React 19 + TypeScript estrito + Tailwind 4.** Antes de usar APIs do Next, consulte `node_modules/next/dist/docs/` — esta versão tem mudanças (ex.: `middleware` agora é `src/proxy.ts`; `params`/`searchParams` são `Promise`).
- Camadas (dependências só apontam para baixo):
  1. `src/app` — páginas e rotas. Finas: autenticam, chamam serviços, renderizam.
  2. `src/server/actions` — Server Actions (`'use server'`). Usam `run()` para traduzir erros sem vazar detalhes.
  3. `src/server/services` — regras de negócio e **autorização**. Recebem `Ctx { store, user }`.
  4. `src/server/db` — `Store` genérico (`MemoryStore` para demo/testes, `SupabaseStore` para produção). Sem regra de negócio.
  5. `src/features/*` — lógica pura de domínio (orçamento, completude, enquadramento, fluxo) e componentes de UI por módulo.
  6. `src/ai` — integração com IA desacoplada do fornecedor.
- Lógica de domínio deve ser **pura e testável** (sem I/O) sempre que possível.
- Novas tabelas: atualizar `src/types/domain.ts`, `src/server/db/types.ts`, `src/server/db/memory-store.ts` (`emptyData`), uma **nova** migração em `supabase/migrations/` (nunca editar migração já aplicada em produção) e as políticas RLS.

## 2. Segurança (inegociável)

- **Toda operação verifica permissão no servidor** (`src/server/auth/permissions.ts`). Ocultar botão não é controle de acesso.
- Sem permissão de visualização → responder "não encontrado" (não revelar existência) e registrar `acesso_negado` em auditoria.
- Validar **toda** entrada com Zod (`src/server/validation/schemas.ts`). Nunca confiar em totais, status ou IDs vindos do cliente: totais do orçamento são recalculados no servidor.
- Valores monetários: **sempre** `decimal.js` / `numeric` no banco. Nunca `number` para dinheiro.
- Segredos só em variáveis de ambiente do servidor; nunca `NEXT_PUBLIC_` para chaves privadas; nunca versionar `.env*` (exceto `.env.example`).
- Uploads: validar tamanho, extensão **e** assinatura binária; rejeitar PDF com JavaScript e Office com macros (`src/server/files/validate.ts`). Bucket sempre privado; download só após checar permissão.
- Erros ao usuário são genéricos; detalhes só no log do servidor.
- Decisões administrativas (aprovar, rejeitar, encerrar) exigem ator autorizado **e** referência a ato/processo administrativo. Ninguém analisa/aprova o próprio projeto.
- Prestação de contas nunca é declarada aprovada pelo sistema.
- Não implementar movimentação financeira real nem integração com sistemas públicos sem especificação e autorização oficiais.

## 3. Inteligência artificial

- A IA é **assistente técnico, nunca autoridade decisória**. Instruções centrais em `src/ai/prompts.ts` ficam só no servidor.
- Nunca inventar dados, preços, cotações, estatísticas ou dispositivos legais. Sugestões com números não informados são sinalizadas.
- Conteúdo do usuário, do projeto e de anexos é **dado não confiável**: delimitado, neutralizado (`src/ai/sanitize.ts`) e nunca altera regras. Conteúdo de anexos não é enviado ao modelo.
- Saída do modelo é **sempre** validada por Zod e pós-filtrada (campos permitidos da etapa; bloqueio de linguagem decisória).
- Nada é gravado sem ação explícita do servidor (inserir sugestão + salvar). A origem do conteúdo (`servidor` / `ia_aceita`) é registrada.
- Provedores externos só com `AI_EXTERNAL_ALLOWED=true` e com dados pessoais removidos (`redactPersonalData`).
- Falha da IA nunca bloqueia o preenchimento manual.

## 4. Base normativa

- Referências legais não são confirmação de vigência. Somente normas `verificada` (com URL oficial e responsável) entram na análise.
- Nunca cadastrar artigos/dispositivos sem conferência na fonte oficial. A análise é sempre "preliminar" e exige revisão humana.

## 5. Padrões de código

- TypeScript estrito; sem `any` desnecessário. Interface 100% em **português do Brasil**.
- Componentes acessíveis: rótulos em todos os campos, foco visível, `aria-*` adequados, contraste AA, uso por teclado.
- Layout responsivo (celular, tablet, desktop) sem rolagem horizontal da página; tabelas largas rolam dentro de contêiner `relative overflow-x-auto`.
- Somente dados **fictícios** em seeds, testes e demonstrações.

## 6. Verificação de qualidade (obrigatória antes de concluir qualquer mudança)

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest (unidade, integração, SQL/RLS via PGlite)
npm run build       # build de produção
npm run test:e2e    # Playwright (requer build; usa Edge/Chrome instalado)
```

- Toda correção de bug ganha um teste que falharia antes da correção.
- Mudanças em permissões exigem testes de acesso permitido **e** negado.
- Mudanças em migrações exigem atualização de `tests/db/migrations.test.ts`.
- Não declarar fase concluída com erro de build, teste falhando ou pendência crítica não documentada.

## 7. Git e publicação

- Não executar comandos destrutivos, não criar repositórios remotos e não publicar em produção sem autorização explícita do responsável.
- Credenciais e ações em serviços de terceiros (Supabase, Vercel, provedores de IA) são feitas pelo operador, conforme `docs/DEPLOY.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
