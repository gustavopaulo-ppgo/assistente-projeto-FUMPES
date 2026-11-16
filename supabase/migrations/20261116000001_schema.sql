-- =====================================================================
-- Sistema Inteligente FUNPES — esquema relacional
-- Valores monetários: numeric(16,2); quantidades: numeric(16,3).
-- Exclusão lógica (deleted_at) em: organizational_units, projects,
-- project_documents, legal_references, project_expenses.
-- =====================================================================

-- gen_random_uuid() é nativo no PostgreSQL 13+ (sem extensões adicionais).

-- ------------------------------------------------------------ estrutura organizacional
create table public.organizational_units (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  acronym text not null check (char_length(acronym) between 1 and 30),
  city text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index organizational_units_acronym_uq on public.organizational_units (lower(acronym)) where deleted_at is null;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text not null,
  registration text,
  unit_id uuid references public.organizational_units (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index profiles_email_uq on public.profiles (lower(email));
create index profiles_unit_idx on public.profiles (unit_id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('proponente', 'gestor_unidade', 'analista_tecnico', 'gestor_financeiro', 'administrador')),
  unit_id uuid references public.organizational_units (id) on delete cascade, -- null = abrangência global
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, role, unit_id)
);
create index user_roles_user_idx on public.user_roles (user_id);

-- ------------------------------------------------------------ projetos
create sequence public.project_code_seq;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null check (char_length(title) between 1 and 200),
  unit_id uuid not null references public.organizational_units (id),
  owner_id uuid not null references public.profiles (id),
  thematic_area text,
  project_type text check (project_type in ('manutencao_programas', 'aparelhamento', 'equipamentos', 'servicos', 'construcao', 'reforma_ampliacao', 'material_permanente', 'processamento_dados', 'capacitacao', 'outros')),
  location text,
  beneficiaries text,
  status text not null default 'rascunho' check (status in ('rascunho', 'em_elaboracao', 'encaminhado', 'em_analise', 'correcao_solicitada', 'validado_tecnicamente', 'aguardando_decisao', 'aprovado', 'rejeitado', 'em_execucao', 'concluido', 'prestacao_contas', 'encerrado')),
  current_step smallint not null default 1 check (current_step between 1 and 10),
  completion smallint not null default 0 check (completion between 0 and 100),
  requested_amount numeric(16, 2) not null default 0 check (requested_amount >= 0),
  approved_amount numeric(16, 2) check (approved_amount >= 0),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index projects_unit_idx on public.projects (unit_id) where deleted_at is null;
create index projects_owner_idx on public.projects (owner_id) where deleted_at is null;
create index projects_status_idx on public.projects (status) where deleted_at is null;
create index projects_updated_idx on public.projects (updated_at desc);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null check (member_role in ('responsavel', 'colaborador', 'leitor')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.project_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  section_key text not null,
  content jsonb not null default '{}'::jsonb,
  field_meta jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (project_id, section_key)
);

create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  reason text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create table public.project_objectives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  description text not null,
  expected_result text,
  position integer not null default 0
);
create index project_objectives_project_idx on public.project_objectives (project_id);

create table public.project_indicators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  formula text,
  baseline text,
  target text,
  unit text,
  frequency text,
  source text,
  current_value text,
  position integer not null default 0
);
create index project_indicators_project_idx on public.project_indicators (project_id);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  context text not null check (context in ('elaboracao', 'execucao', 'prestacao_contas')),
  category text not null,
  name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'apresentado' check (status in ('pendente', 'apresentado', 'conferido', 'rejeitado')),
  review_note text,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index project_documents_project_idx on public.project_documents (project_id) where deleted_at is null;

create table public.project_budget_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  description text not null,
  category text,
  unit text,
  quantity numeric(16, 3) not null default 0 check (quantity >= 0),
  unit_price numeric(16, 2) not null default 0 check (unit_price >= 0),
  total numeric(16, 2) not null default 0,
  source text,
  reference_date date,
  document_id uuid references public.project_documents (id) on delete set null,
  expense_nature text,
  justification text,
  estimates jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  -- total sempre coerente com quantidade × preço (arredondamento meio para cima)
  constraint budget_total_consistente check (total = round(quantity * unit_price, 2))
);
create index project_budget_items_project_idx on public.project_budget_items (project_id);

create table public.project_schedule (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  activity text not null,
  responsible text,
  start_date date,
  end_date date,
  is_milestone boolean not null default false,
  depends_on uuid references public.project_schedule (id) on delete set null,
  planned_amount numeric(16, 2) not null default 0 check (planned_amount >= 0),
  position integer not null default 0,
  check (end_date is null or start_date is null or end_date >= start_date),
  check (depends_on is null or depends_on <> id)
);
create index project_schedule_project_idx on public.project_schedule (project_id);

create table public.project_risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  category text not null check (category in ('tecnico', 'financeiro', 'administrativo', 'outro')),
  description text not null,
  probability smallint not null check (probability between 1 and 5),
  impact smallint not null check (impact between 1 and 5),
  mitigation text,
  owner text,
  position integer not null default 0
);
create index project_risks_project_idx on public.project_risks (project_id);

create table public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id),
  review_type text not null check (review_type in ('gestor_unidade', 'tecnica', 'financeira')),
  recommendation text not null check (recommendation in ('favoravel', 'correcao', 'desfavoravel', 'informativa')),
  opinion text not null,
  created_at timestamptz not null default now()
);
create index project_reviews_project_idx on public.project_reviews (project_id);

-- histórico de tramitação (cada transição de estado)
create table public.project_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  from_status text not null,
  to_status text not null,
  actor_id uuid not null references public.profiles (id),
  note text,
  administrative_reference text,
  created_at timestamptz not null default now(),
  -- decisões finais exigem evidência administrativa
  check (to_status not in ('aprovado', 'rejeitado', 'encerrado') or coalesce(trim(administrative_reference), '') <> '')
);
create index project_approvals_project_idx on public.project_approvals (project_id, created_at);

-- ------------------------------------------------------------ base normativa e fontes
create table public.legal_references (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  number text not null,
  date date,
  issuer text not null,
  official_url text check (official_url is null or official_url like 'https://%'),
  text text,
  version text,
  last_verified_at date,
  validation_status text not null default 'nao_verificada' check (validation_status in ('nao_verificada', 'verificada', 'desatualizada')),
  validated_by uuid references public.profiles (id),
  categories text[] not null default '{}',
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (validation_status <> 'verificada' or (official_url is not null and validated_by is not null))
);

create table public.funding_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  active boolean not null default true
);

create table public.project_funding_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  funding_source_id uuid not null references public.funding_sources (id),
  amount numeric(16, 2) not null check (amount >= 0),
  notes text
);
create index project_funding_allocations_project_idx on public.project_funding_allocations (project_id);

-- ------------------------------------------------------------ execução e prestação de contas
create table public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  budget_item_id uuid references public.project_budget_items (id) on delete set null,
  description text not null,
  supplier text,
  invoice_number text,
  issue_date date,
  payment_date date,
  amount numeric(16, 2) not null check (amount > 0),
  status text not null default 'lancada' check (status in ('lancada', 'conferida', 'rejeitada')),
  document_id uuid references public.project_documents (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (status <> 'conferida' or document_id is not null)
);
create index project_expenses_project_idx on public.project_expenses (project_id) where deleted_at is null;

create table public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  goal text not null,
  description text,
  planned_date date,
  delivered_date date,
  physical_progress smallint not null default 0 check (physical_progress between 0 and 100),
  status text not null default 'planejada' check (status in ('planejada', 'em_andamento', 'entregue', 'cancelada')),
  document_id uuid references public.project_documents (id) on delete set null,
  created_at timestamptz not null default now(),
  check (status <> 'entregue' or delivered_date is not null)
);
create index project_deliverables_project_idx on public.project_deliverables (project_id);

create table public.accountability_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  item text not null,
  status text not null default 'pendente' check (status in ('pendente', 'apresentado', 'conferido', 'rejeitado')),
  document_id uuid references public.project_documents (id) on delete set null,
  reviewer_id uuid references public.profiles (id),
  note text,
  updated_at timestamptz not null default now(),
  check (status <> 'conferido' or (document_id is not null and reviewer_id is not null))
);
create index accountability_records_project_idx on public.accountability_records (project_id);

-- ------------------------------------------------------------ governança
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  project_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_project_idx on public.audit_logs (project_id);

create table public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  step smallint not null check (step between 1 and 10),
  user_message text not null default '',
  provider text not null,
  model text not null,
  response jsonb not null default '{}'::jsonb,
  status text not null check (status in ('sugerida', 'aceita', 'parcial', 'descartada', 'erro')),
  accepted_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index ai_interactions_user_idx on public.ai_interactions (user_id, created_at desc);
create index ai_interactions_project_idx on public.ai_interactions (project_id, step);

create table public.system_settings (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

-- ------------------------------------------------------------ gatilhos

-- perfil criado automaticamente para cada usuário do Supabase Auth
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), lower(new.email))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- código sequencial do projeto (FUNPES-AAAA-NNNN)
create or replace function public.set_project_code() returns trigger
language plpgsql as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'FUNPES-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.project_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create trigger projects_set_code before insert on public.projects
for each row execute function public.set_project_code();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger projects_touch before update on public.projects
for each row execute function public.touch_updated_at();

-- toda mudança de estado precisa de registro de tramitação feito pelo mesmo usuário
create or replace function public.enforce_status_trail() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if not exists (
      select 1 from public.project_approvals a
      where a.project_id = new.id and a.from_status = old.status and a.to_status = new.status
        and a.actor_id = auth.uid() and a.created_at > now() - interval '5 minutes'
    ) then
      raise exception 'Mudança de estado sem registro de tramitação correspondente';
    end if;
  end if;
  return new;
end $$;

create trigger projects_status_trail before update of status on public.projects
for each row execute function public.enforce_status_trail();
