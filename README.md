# Sistema Inteligente FUNPES

**Plataforma de Elaboração e Gestão de Projetos da Polícia Penal de Goiás** — aplicação web que orienta servidores na elaboração, fundamentação, revisão, acompanhamento, execução e prestação de contas de projetos destinados ao Fundo Penitenciário Estadual (FUNPES), com apoio de um assistente de IA e **controle humano de todas as decisões administrativas**.

> ⚠️ Os dados incluídos (usuários, unidades, projetos, valores, cotações) são **fictícios**. O sistema não substitui a análise jurídica, técnica e orçamentária competente, e seus estados internos não equivalem a atos oficiais.

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Autenticação e perfis** | Supabase Auth (produção) ou sessão assinada (demonstração). Perfis: proponente, gestor de unidade, analista técnico, gestor financeiro, administrador — com abrangência por unidade e vínculo com o projeto. |
| **Criação guiada (10 etapas)** | Identificação, diagnóstico, justificativa, objetivos/indicadores, solução, orçamento, cronograma, riscos, documentação, revisão. Perguntas em linguagem simples, salvamento persistente, navegação livre entre etapas sem perda de dados, percentual de conclusão. |
| **Assistente de IA** | Interpreta respostas, pergunta o que falta, reescreve em linguagem institucional, aponta inconsistências e pendências. Distingue *informado pelo servidor*, *sugestão da IA aceita* e *pendente*. Não inventa dados nem preços; nada é gravado sem confirmação. Provedores: `local` (padrão, sem envio externo), Gemini, OpenAI. |
| **Enquadramento normativo** | Base de normas administrável com validação humana; análise preliminar com hipótese, base, dispositivos confirmados, restrições, documentos e pendências, classificada em 4 categorias. |
| **Orçamento** | Planilha com cálculo decimal exato, subtotais, múltiplas estimativas (mediana/média/menor), detecção de campos incompletos e divergências, memória de cálculo. |
| **Documentos** | Exporta projeto completo (PDF e DOCX editável, com capa, sumário e todas as seções), orçamento e cronograma (XLSX com fórmulas), relatório de pendências, checklist documental, relatório de execução. Modelos configuráveis sem alterar código. |
| **Tramitação** | Rascunho → … → Encerrado, configurável, com permissões por transição, justificativa, referência administrativa obrigatória para decisões finais, histórico e versões. |
| **Execução e prestação de contas** | Metas e entregas, despesas com notas/comprovantes, previsto × executado, indicadores, evidências, checklist de prestação de contas com conferência humana. |
| **Painel** | Indicadores e valores calculados do banco, respeitando a visibilidade de cada usuário, com filtros por período, unidade, categoria, responsável e situação. |
| **Administração** | Usuários e papéis, unidades, identidade visual (cores e logotipo autorizado), modelo documental, fluxo, retenção de registros, trilha de auditoria. |

## Executar localmente (modo demonstração — sem credenciais)

Requisitos: **Node.js 20.9+** (testado com 24).

```bash
npm install
cp .env.example .env.local      # opcional no modo demo
npm run dev                     # http://localhost:3000
```

Usuários fictícios (senha **`demo-funpes`**):

| E-mail | Perfil |
|---|---|
| `ana.proponente@demo.funpes.local` | Proponente — Unidade Alfa |
| `bruno.colaborador@demo.funpes.local` | Proponente (colaborador do projeto de informática) |
| `carla.gestora@demo.funpes.local` | Gestora da Unidade Alfa |
| `diego.analista@demo.funpes.local` | Analista técnico (todas as unidades) |
| `elisa.financeiro@demo.funpes.local` | Gestora financeira (todas as unidades) |
| `admin@demo.funpes.local` | Administrador |
| `fabio.proponente@demo.funpes.local` | Proponente — Unidade Beta |

No modo demo em desenvolvimento, os dados persistem em `.data/demo-db.json` (apague o arquivo para reiniciar).

## Executar com Supabase (persistência real)

1. Crie um projeto no Supabase e aplique as migrações de `supabase/migrations/` (CLI `supabase db push` ou SQL Editor, em ordem) e, opcionalmente, `supabase/seed.sql`.
2. Configure `.env.local` com `DATA_BACKEND=supabase`, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Crie o primeiro usuário em *Authentication → Users* e promova-o a administrador com `docs/bootstrap-admin.sql`.
4. `npm run dev`. Detalhes em [docs/DEPLOY.md](docs/DEPLOY.md).

## Testes e qualidade

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run test        # 79 testes: unidade, integração, SQL/RLS (PGlite)
npm run build       # build de produção
npm run test:e2e    # ponta a ponta no navegador (requer build; usa Edge — PW_CHANNEL=chrome para Chrome)
npm run verify      # typecheck + lint + test + build
```

Cobertura dos cenários obrigatórios: cadastro de projeto; salvamento e recuperação; navegação entre etapas; cálculo orçamentário; geração de documentos (PDF/DOCX/XLSX); controle de permissões; validação de campos; falha e timeout da IA; ausência de base normativa; acesso indevido; transição não autorizada; falha de integração; arquivo inválido; entrada maliciosa em prompts e documentos; políticas RLS em PostgreSQL real.

## Estrutura

```
src/app            páginas e rotas (App Router) e APIs de exportação/download
src/components     componentes reutilizáveis (UI acessível, shell)
src/features       módulos: projects, budget, legal, execution, workflow, admin
src/server         serviços, autorização, persistência, exportações, validação
src/ai             provedores de IA, instruções do agente, sanitização
src/types          tipagens de domínio
supabase           migrações SQL (esquema + RLS) e seed
tests              unidade/integração (vitest), SQL (PGlite), e2e (Playwright)
docs               arquitetura, implantação e segurança
```

Documentação: [Arquitetura](docs/ARQUITETURA.md) · [Implantação (GitHub/Vercel/Supabase)](docs/DEPLOY.md) · [Segurança e LGPD](docs/SEGURANCA.md) · [Regras para agentes](AGENTS.md)

## Situação atual e pendências

Veja a seção *Pendências* em [docs/ARQUITETURA.md](docs/ARQUITETURA.md#pendências-conhecidas).
