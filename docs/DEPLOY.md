# Implantação: GitHub, Supabase e Vercel

> Todas as ações abaixo envolvem contas e credenciais de terceiros e devem ser executadas pelo **operador responsável**. Nenhum segredo deve ser versionado.

## 1. GitHub

O repositório local já aponta para `origin`. Fluxo recomendado:

```bash
git checkout -b feat/minha-mudanca
npm run verify               # typecheck + lint + testes + build
git add -A && git commit -m "descrição"
git push -u origin feat/minha-mudanca   # abre prévia na Vercel
```

O workflow `.github/workflows/ci.yml` roda typecheck, lint, testes (inclusive SQL/RLS) e build em cada push/PR. Recomenda-se proteger a branch `main` exigindo o CI verde e revisão.

## 2. Supabase

1. Crie dois projetos: **homologação** e **produção** (separação de ambientes).
2. Aplique as migrações, em ordem:
   - via CLI: `supabase link --project-ref <ref>` e `supabase db push`; ou
   - via *SQL Editor*: execute `supabase/migrations/*.sql` em ordem alfabética.
3. (Opcional) Execute `supabase/seed.sql` para normas iniciais (não verificadas) e fonte FUNPES.
4. *Authentication → Providers*: mantenha **Email** habilitado; desabilite cadastro público (*Allow new users to sign up* = off) para que só convites criem contas.
5. *Authentication → URL Configuration*: defina a URL do site (domínio da Vercel).
   Em *Authentication → Email Templates*, ajuste os links de **Invite user** e **Reset password** para:
   `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite` (convite) e
   `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery` (recuperação).
   O convidado define a própria senha em `/auth/definir-senha`.
6. Convide o primeiro usuário (*Authentication → Users → Invite*), depois promova-o a administrador executando `docs/bootstrap-admin.sql` com o e-mail dele.
7. Confirme que o bucket `project-documents` foi criado **privado** (*Storage*).
8. Copie `Project URL` e `anon public key` (*Settings → API*). A `service_role` só é necessária para rotinas administrativas futuras; nunca a exponha.

## 3. Vercel

1. *Add New → Project* → importe o repositório do GitHub. Framework detectado: Next.js. Comandos padrão (`npm install`, `npm run build`).
2. *Settings → Environment Variables* — cadastre separadamente para **Production** e **Preview**:

| Variável | Production | Preview |
|---|---|---|
| `DATA_BACKEND` | `supabase` | `supabase` (homologação) ou `demo` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | projeto de produção | projeto de homologação |
| `ALLOW_DEMO_IN_PRODUCTION` | `false` | `true` somente se `DATA_BACKEND=demo` |
| `SESSION_SECRET` | não usado com Supabase | obrigatório se `demo` (≥ 32 caracteres) |
| `AI_PROVIDER` | `local` (até haver autorização) | `local` |
| `AI_EXTERNAL_ALLOWED`, `GEMINI_API_KEY`/`OPENAI_API_KEY`, `AI_MODEL` | só com autorização institucional formal | — |
| `UPLOAD_MAX_MB` | `10` | `10` |

3. Cada branch enviada ao GitHub gera uma **prévia**; merges na `main` publicam em **produção**.
4. No modo demo em prévia, os dados ficam em memória da função serverless e **se perdem** entre execuções — adequado apenas para demonstração.
5. Limite de corpo das Server Actions está em 12 MB (`next.config.ts`); o padrão de upload é 10 MB. Verifique os limites do seu plano Vercel.

## 4. Checklist antes de publicar em produção

- [ ] `npm run verify` e `npm run test:e2e` verdes.
- [ ] Migrações aplicadas e RLS ativa em todas as tabelas (`select tablename, rowsecurity from pg_tables where schemaname='public'`).
- [ ] Bucket privado; cadastro público de usuários desabilitado.
- [ ] `DATA_BACKEND=supabase` e `ALLOW_DEMO_IN_PRODUCTION=false` em produção.
- [ ] Normas revisadas e verificadas por responsável; identidade visual com arquivos autorizados.
- [ ] Política de retenção definida; responsável pela aplicação periódica.
- [ ] Revisão de segurança (docs/SEGURANCA.md) assinada pelo responsável.
- [ ] Nenhum dado real sensível de internos inserido em ambientes de teste.
