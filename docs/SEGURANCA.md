# Segurança, governança e LGPD

O sistema é destinado a uma instituição de segurança pública. Este documento registra os controles implementados e a revisão de segurança feita antes da habilitação de publicação.

## Controles implementados

| Requisito | Implementação | Onde |
|---|---|---|
| Autenticação confiável | Supabase Auth (senha + convite; cadastro público desabilitado). Demo: cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção, HMAC-SHA256, expiração de 8 h, comparação em tempo constante. | `src/server/auth` |
| Permissão por operação | Funções puras por papel, unidade e vínculo, chamadas em todo serviço; segregação de funções. | `src/server/auth/permissions.ts` |
| RLS | Ativa e forçada em todas as 24 tabelas; funções `SECURITY DEFINER` com `search_path` fixo; testes em PostgreSQL real. | `supabase/migrations/*security.sql`, `tests/db` |
| Trilha de estados no banco | Gatilho recusa mudança de status sem registro de tramitação do mesmo usuário; decisões finais exigem referência administrativa (CHECK). | migração de esquema |
| Validação de entradas | Zod em todas as ações; remoção de caracteres de controle; limites de tamanho; enumerações fechadas; campos desconhecidos rejeitados. | `src/server/validation` |
| Injeção (SQL/fórmulas) | Consultas parametrizadas (PostgREST/supabase-js); IDs validados; células de planilha iniciadas por `= + - @` são neutralizadas. | `supabase-store.ts`, `exports/xlsx.ts` |
| Upload seguro | Limite de tamanho, lista de extensões, assinatura binária, rejeição de dupla extensão executável, PDF com JavaScript/ações e Office com macros, nomes sanitizados, hash SHA-256. | `src/server/files/validate.ts` |
| Documentos privados | Bucket privado; download verifica permissão a cada acesso; URL assinada de 60 s (Supabase) ou streaming com `Content-Disposition: attachment`, `nosniff` e CSP `sandbox`. | `src/app/api/documentos` |
| Auditoria | Criação, edição, tramitação, negações de acesso, uploads (aceitos/rejeitados), downloads, exportações, consultas à IA, configurações. Apenas metadados. | `audit_logs` |
| Erros sem exposição | Mensagens genéricas ao usuário; detalhes só no log do servidor; páginas de erro sem stack. | `server/actions/run.ts`, `route-helpers.ts` |
| Menor privilégio | Cliente Supabase com a sessão do usuário (não a chave de serviço); administrador não edita conteúdo de projetos; ninguém aprova o próprio projeto. | — |
| Cabeçalhos HTTP | HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` removido. | `next.config.ts` |
| Acesso às interações de IA | Cada usuário vê apenas as próprias; administrador vê todas; somente quem elabora usa o assistente; limite por hora. | RLS `ai_*`, `services/ai.ts` |
| Prompt injection | Instruções centrais só no servidor; dados delimitados como não confiáveis; neutralização de delimitadores e caracteres invisíveis/bidirecionais; detecção de padrões; validação de esquema; pós-filtro (campos da etapa, linguagem decisória, números não informados); anexos não são enviados ao modelo. | `src/ai` |
| Retenção configurável | Prazos para interações de IA e auditoria; aplicação manual pelo administrador (auditada). | Configurações |
| Separação de ambientes | Projetos Supabase distintos para homologação e produção; variáveis por ambiente na Vercel; modo demo bloqueado em produção. | `docs/DEPLOY.md`, `lib/env.ts` |

## LGPD e dados sensíveis

- Ambientes de teste e demonstração usam **somente dados fictícios**.
- O sistema não foi projetado para armazenar dados pessoais de custodiados; os formulários alertam para não inseri-los.
- Provedores externos de IA ficam **desabilitados** até autorização institucional (`AI_EXTERNAL_ALLOWED`). Quando habilitados, o contexto é minimizado (sem nomes, e-mails ou anexos) e passa por remoção de CPF, CNPJ, RG, e-mail, telefone e identificadores de custodiados. Avalie o contrato do provedor (retenção, treinamento, localização dos dados) antes de habilitar.
- Informações operacionais protegidas não devem ser enviadas a modelos externos em nenhuma hipótese.

## Revisão de segurança antes da publicação (16/11/2026)

Verificações realizadas sobre o código desta versão:

- [x] Todas as Server Actions chamam `requireContext()` e delegam a serviços que verificam permissão (inclusive ações administrativas, revalidadas além do layout `/admin`).
- [x] Rotas de API retornam 401 sem sessão e 404 sem permissão (teste E2E e de integração).
- [x] Nenhum segredo no repositório; `.env*` ignorado; chave de serviço nunca usada no fluxo do usuário.
- [x] Totais e status nunca aceitos do cliente; transições validadas contra o fluxo e o papel do usuário.
- [x] Uploads maliciosos rejeitados (testes com HTML disfarçado de PDF, PDF com JavaScript, DOCX com macro, SVG, `.exe.pdf`, path traversal).
- [x] Saídas da IA maliciosas filtradas (testes com campo fora da etapa, "aprovo o projeto", estatística inventada).
- [x] RLS validada em PostgreSQL real: isolamento entre unidades, autopromoção bloqueada, auditoria não legível por usuários comuns, anônimo só lê a identidade visual.
- [x] `npm audit`: 0 vulnerabilidades conhecidas.
- [x] Código-fonte sem caracteres invisíveis/bidirecionais literais.

Riscos residuais (aceitar ou tratar antes da produção):

1. **Sem antivírus** nos uploads — integrar serviço institucional de varredura.
2. **Sem CSP global com nonce** — os cabeçalhos atuais mitigam clickjacking e sniffing; recomenda-se CSP estrita quando o domínio final estiver definido.
3. **Tentativas de login** dependem dos limites do Supabase Auth; considerar bloqueio progressivo e MFA para administradores e gestores.
4. **Aplicação da retenção** é manual; agendar rotina (ex.: Supabase Cron) após definição institucional dos prazos.
5. **Logs de servidor** (Vercel) devem ter retenção e acesso controlados pelo órgão.
