# Arquitetura

## Visão geral

```
Navegador (React 19, client components mínimos)
   │  Server Actions / Route Handlers (HTTPS)
   ▼
Next.js 16 (App Router) — src/app
   │  requireContext(): sessão → perfil + papéis
   ▼
Serviços de domínio — src/server/services      ← autorização em TODA operação
   │  (permissions.ts, schemas Zod, auditoria)
   ├──► Lógica pura — src/features (orçamento, completude, enquadramento, fluxo, execução)
   ├──► IA — src/ai (local | Gemini | OpenAI) com sanitização e validação de saída
   ├──► Exportações — src/server/exports (PDF pdf-lib, DOCX docx, XLSX exceljs)
   └──► Store genérico — src/server/db
          ├─ SupabaseStore  → PostgreSQL com RLS + Storage privado (produção)
          └─ MemoryStore    → dados fictícios (demonstração e testes)
```

### Decisões arquiteturais

| Decisão | Motivo |
|---|---|
| **Store genérico com dois adaptadores** | Uma única camada de regras/autorização; o sistema roda e é testável sem credenciais (modo demo), e em produção usa Supabase com RLS como segunda barreira. |
| **Autorização nos serviços + RLS** | Defesa em profundidade: a aplicação aplica regras finas (transições, segregação de funções); o banco garante isolamento mesmo com acesso direto à API. |
| **Gatilho de trilha de estados** | O banco recusa mudança de `status` sem registro em `project_approvals` feito pelo mesmo usuário. |
| **Decimais como string + `decimal.js` + `numeric`** | Evita erros de ponto flutuante; o banco ainda impõe `total = round(qtd × preço, 2)`. |
| **IA desacoplada por REST** | Sem SDK proprietário; troca de provedor por variável de ambiente; provedor `local` determinístico como padrão seguro. |
| **Fluxo e modelos em `system_settings`** | Configuráveis pelo administrador sem alterar código; validados por Zod, com travas (decisões finais exigem referência administrativa; sem autoaprovação). |
| **Componentes próprios (Tailwind)** | Acessíveis e sem dependências pesadas de UI. |
| **Geração de documentos em JS puro** | Compatível com funções serverless da Vercel (sem binários nativos). |

## Modelo de dados

24 tabelas (ver `supabase/migrations/20261116000001_schema.sql`): `profiles`, `organizational_units`, `user_roles`, `projects`, `project_members`, `project_sections`, `project_versions`, `project_objectives`, `project_indicators`, `project_budget_items`, `project_schedule`, `project_risks`, `project_documents`, `project_reviews`, `project_approvals`, `legal_references`, `funding_sources`, `project_funding_allocations`, `project_expenses`, `project_deliverables`, `accountability_records`, `audit_logs`, `ai_interactions`, `system_settings`.

- Exclusão lógica (`deleted_at`): unidades, projetos, documentos, normas, despesas. Linhas filhas sem valor histórico (itens de tabela do projeto) são substituídas; o histórico fica em `project_versions`.
- Conteúdo textual das etapas em `project_sections.content` (JSONB) com `field_meta` registrando a **origem** de cada campo (`servidor` | `ia_aceita`), autor e data.
- Restrições de integridade: CHECKs de domínio, totais coerentes, datas coerentes, conferência exige documento/revisor, decisão final exige referência administrativa, norma verificada exige URL oficial e responsável.

## Fluxo de estados (padrão, configurável)

```
rascunho → em_elaboracao → encaminhado → em_analise → validado_tecnicamente → aguardando_decisao → aprovado → em_execucao → concluido → prestacao_contas → encerrado
                                 │             │                │                       └→ rejeitado
                                 └─────────────┴→ correcao_solicitada → encaminhado
```

Encaminhar exige ausência de pendências obrigatórias. Aprovar, rejeitar e encerrar exigem justificativa **e** referência a ato/processo administrativo. Responsáveis e colaboradores nunca analisam nem decidem sobre o próprio projeto.

## Dependências externas e credenciais

| Serviço | Uso | Credenciais | Obrigatório |
|---|---|---|---|
| Supabase | PostgreSQL, Auth, Storage | URL + chave anônima (+ chave de serviço opcional) | Produção |
| Vercel | Hospedagem, prévias por branch | Conta/projeto conectado ao GitHub | Publicação |
| GitHub | Versionamento, CI | Repositório (já existe `origin`) | Sim |
| Google Gemini / OpenAI | IA externa (opcional) | Chave de API + autorização institucional | Não |

Nenhum serviço pago é obrigatório para avaliar o sistema (modo demo + IA local).

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| IA "alucinar" dados ou normas | Provedor local por padrão; prompt com regras; validação Zod; pós-filtro de campos; sinalização de números não informados; confirmação humana obrigatória. |
| Vazamento de dados a provedores externos | Bloqueado por padrão (`AI_EXTERNAL_ALLOWED=false`); minimização e remoção de CPF/e-mail/telefone; anexos nunca enviados. |
| Prompt injection via mensagens/anexos | Delimitação de dados não confiáveis, neutralização de delimitadores e caracteres invisíveis, detecção de padrões, pós-filtro. |
| Uso de norma desatualizada | Normas só entram na análise após verificação humana; editar a norma volta a exigir verificação. |
| Confusão entre estado do sistema e ato oficial | Avisos na interface e nos documentos; referência administrativa obrigatória. |
| Modo demo em produção | Bloqueado em `NODE_ENV=production` sem `ALLOW_DEMO_IN_PRODUCTION=true`. |

## Pendências conhecidas

Funcionalidades implementadas e testadas estão listadas no README. Itens **não concluídos** ou que dependem do operador:

1. **Supabase não foi conectado neste ambiente** (sem credenciais). As migrações foram validadas em PostgreSQL 17 (PGlite) com esquemas `auth`/`storage` simulados, incluindo RLS; falta aplicar e testar num projeto Supabase real (incluindo políticas de Storage).
2. **Cadastro de usuários no modo Supabase** é feito por convite no painel do Supabase; a tela de administração edita perfil, unidade e papéis, mas não cria contas de autenticação.
3. **Conteúdo normativo**: as normas iniciais estão como "não verificadas", sem regras nem dispositivos — exige conferência humana nas fontes oficiais (inclusive a URL oficial da Lei Estadual nº 16.536/2009).
4. **Provedores externos de IA** (Gemini/OpenAI) estão implementados via REST, mas não foram exercitados contra as APIs reais (sem chaves). Confirme o nome do modelo vigente em `AI_MODEL`.
5. **Sumário do DOCX** é um campo do Word que precisa ser atualizado ao abrir o arquivo; no PDF o sumário é gerado com números de página.
6. **Escaneamento antivírus** de uploads não está incluído (há validação de assinatura, PDF ativo e macros); recomenda-se integrar um serviço institucional.
7. **Limite de taxa da IA** usa contagem no banco por usuário/hora; não há limite global por IP.
8. **Testes E2E** cobrem os fluxos principais no modo demo; não há E2E contra Supabase.
9. **Notificações** (e-mail) de tramitação não foram implementadas.
