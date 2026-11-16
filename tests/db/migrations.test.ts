/**
 * Valida as migrações SQL num PostgreSQL real (PGlite/WASM), com os esquemas
 * "auth" e "storage" do Supabase simulados, e exercita as políticas RLS
 * como usuários diferentes (papel "authenticated" + auth.uid()).
 */
import fs from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema public, auth, storage to authenticated, anon;
`

const U = {
  ana: '10000000-0000-4000-8000-000000000001',
  fabio: '10000000-0000-4000-8000-000000000002',
  admin: '10000000-0000-4000-8000-000000000003',
  diego: '10000000-0000-4000-8000-000000000004',
  elisa: '10000000-0000-4000-8000-000000000005',
}
const UNIT_A = '20000000-0000-4000-8000-00000000000a'
const UNIT_B = '20000000-0000-4000-8000-00000000000b'

let db: PGlite

/** Executa SQL como um usuário autenticado (RLS ativa). */
async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    const r = await db.query<T>(sql, params)
    return r.rows
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  const dir = path.resolve(__dirname, '../../supabase/migrations')
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'))
  await db.exec(fs.readFileSync(path.resolve(__dirname, '../../supabase/seed.sql'), 'utf8'))
  await db.exec(`grant select, insert, update, delete on all tables in schema public, storage to authenticated;
                 grant select on public.system_settings to anon;
                 grant usage, select on all sequences in schema public to authenticated;`)
  // usuários (o gatilho cria os perfis)
  for (const [name, id] of Object.entries(U)) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${name}@teste.local`, { full_name: name }])
  }
  await db.exec(`
    insert into public.organizational_units (id, name, acronym) values ('${UNIT_A}', 'Unidade A', 'UA'), ('${UNIT_B}', 'Unidade B', 'UB');
    insert into public.user_roles (user_id, role, unit_id) values
      ('${U.ana}', 'proponente', '${UNIT_A}'), ('${U.fabio}', 'proponente', '${UNIT_B}'),
      ('${U.admin}', 'administrador', null), ('${U.diego}', 'analista_tecnico', null), ('${U.elisa}', 'gestor_financeiro', null);
  `)
}, 60_000)

describe('migrações Supabase (PostgreSQL real via PGlite)', () => {
  it('cria todas as tabelas exigidas, com RLS ativa', async () => {
    const r = await db.query<{ tablename: string; rowsecurity: boolean }>(`select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1`)
    const names = r.rows.map((x) => x.tablename)
    for (const t of ['profiles', 'organizational_units', 'user_roles', 'projects', 'project_members', 'project_sections', 'project_versions', 'project_objectives', 'project_indicators', 'project_budget_items', 'project_schedule', 'project_risks', 'project_documents', 'project_reviews', 'project_approvals', 'legal_references', 'funding_sources', 'project_funding_allocations', 'project_expenses', 'project_deliverables', 'accountability_records', 'audit_logs', 'ai_interactions', 'system_settings']) {
      expect(names).toContain(t)
    }
    expect(r.rows.every((x) => x.rowsecurity)).toBe(true)
  })

  it('gatilho cria perfil para novo usuário de autenticação', async () => {
    const r = await db.query<{ full_name: string }>(`select full_name from public.profiles where id = $1`, [U.ana])
    expect(r.rows[0].full_name).toBe('ana')
  })

  it('fluxo com RLS: criação, código sequencial, isolamento entre unidades e tramitação rastreada', async () => {
    const [p] = await as<{ id: string; code: string }>(U.ana, `insert into public.projects (code, title, unit_id, owner_id) values ('', 'Projeto A', $1, $2) returning id, code`, [UNIT_A, U.ana])
    expect(p.code).toMatch(/^FUNPES-\d{4}-0001$/)
    await as(U.ana, `insert into public.project_members (project_id, user_id, member_role) values ($1, $2, 'responsavel')`, [p.id, U.ana])
    await as(U.ana, `insert into public.project_sections (project_id, section_key, content) values ($1, 'diagnostico', '{"problema":"x"}')`, [p.id])

    // proponente de outra unidade não cria projeto na unidade A nem enxerga o projeto
    await expect(as(U.fabio, `insert into public.projects (code, title, unit_id, owner_id) values ('', 'Invasão', $1, $2)`, [UNIT_A, U.fabio])).rejects.toThrow()
    expect(await as(U.fabio, `select id from public.projects`)).toEqual([])
    expect(await as(U.fabio, `select id from public.project_sections`)).toEqual([])
    const upd = await as(U.fabio, `update public.project_sections set content = '{}' where project_id = $1 returning id`, [p.id])
    expect(upd).toEqual([])

    // analista não vê projeto em rascunho
    expect(await as(U.diego, `select id from public.projects`)).toEqual([])

    // mudança de estado sem registro de tramitação é bloqueada pelo banco
    await expect(as(U.ana, `update public.projects set status = 'em_elaboracao' where id = $1`, [p.id])).rejects.toThrow(/tramitação/)
    await as(U.ana, `insert into public.project_approvals (project_id, from_status, to_status, actor_id) values ($1, 'rascunho', 'em_elaboracao', $2)`, [p.id, U.ana])
    await as(U.ana, `update public.projects set status = 'em_elaboracao' where id = $1`, [p.id])

    // decisão final sem referência administrativa é rejeitada por restrição
    await expect(
      db.query(`insert into public.project_approvals (project_id, from_status, to_status, actor_id) values ($1, 'aguardando_decisao', 'aprovado', $2)`, [p.id, U.elisa]),
    ).rejects.toThrow()

    // administrador vê tudo
    expect((await as(U.admin, `select id from public.projects`)).length).toBe(1)
  })

  it('orçamento: total incoerente com quantidade × preço é rejeitado', async () => {
    const [p] = await as<{ id: string }>(U.ana, `insert into public.projects (code, title, unit_id, owner_id) values ('', 'Orçamento', $1, $2) returning id`, [UNIT_A, U.ana])
    await as(U.ana, `insert into public.project_budget_items (project_id, description, quantity, unit_price, total) values ($1, 'ok', 3, 0.10, 0.30)`, [p.id])
    await expect(as(U.ana, `insert into public.project_budget_items (project_id, description, quantity, unit_price, total) values ($1, 'errado', 3, 0.10, 999)`, [p.id])).rejects.toThrow()
  })

  it('auditoria: usuário grava apenas em seu nome e não lê; administrador lê', async () => {
    await as(U.ana, `insert into public.audit_logs (actor_id, action, entity) values ($1, 'teste', 'x')`, [U.ana])
    await expect(as(U.ana, `insert into public.audit_logs (actor_id, action, entity) values ($1, 'forjado', 'x')`, [U.admin])).rejects.toThrow()
    expect(await as(U.ana, `select id from public.audit_logs`)).toEqual([])
    expect((await as(U.admin, `select id from public.audit_logs`)).length).toBe(1)
  })

  it('papéis: usuário comum não se autopromove a administrador', async () => {
    await expect(as(U.ana, `insert into public.user_roles (user_id, role) values ($1, 'administrador')`, [U.ana])).rejects.toThrow()
  })

  it('norma só pode ser "verificada" com URL oficial e responsável', async () => {
    await expect(db.query(`update public.legal_references set validation_status = 'verificada' where official_url is null`)).rejects.toThrow()
  })

  it('anônimo só lê a identidade visual', async () => {
    await db.query(`insert into public.system_settings (id, value) values ('institution', '{}'), ('workflow', '{}')`)
    await db.exec(`set role anon;`)
    const rows = (await db.query<{ id: string }>(`select id from public.system_settings`)).rows
    await db.exec(`reset role;`)
    expect(rows.map((r) => r.id)).toEqual(['institution'])
  })
})
