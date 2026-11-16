-- =====================================================================
-- Row Level Security — defesa em profundidade.
-- A aplicação verifica permissões em cada operação (src/server/auth/permissions.ts);
-- estas políticas garantem que, mesmo com acesso direto à API, um usuário
-- só leia/escreva o que seu papel, unidade e vínculo permitem.
-- =====================================================================

-- ------------------------------------------------------------ funções auxiliares
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.has_role(p_role text, p_unit uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_user() and exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role = p_role
      and (r.unit_id is null or p_unit is null or r.unit_id = p_unit)
  )
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('administrador')
$$;

create or replace function public.project_member_role(p_project uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.projects p where p.id = p_project and p.owner_id = auth.uid()) then 'responsavel'
    else (select m.member_role from public.project_members m where m.project_id = p_project and m.user_id = auth.uid())
  end
$$;

-- regra de visibilidade avaliada sobre as colunas da linha (usada diretamente na política
-- de projects, para que INSERT ... RETURNING funcione com a linha recém-criada)
create or replace function public.project_row_visible(p_id uuid, p_owner uuid, p_unit uuid, p_status text, p_deleted timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_user() and p_deleted is null and (
    public.is_admin()
    or p_owner = auth.uid()
    or exists (select 1 from public.project_members m where m.project_id = p_id and m.user_id = auth.uid())
    or public.has_role('gestor_unidade', p_unit)
    or (p_status not in ('rascunho', 'em_elaboracao')
        and (public.has_role('analista_tecnico', p_unit) or public.has_role('gestor_financeiro', p_unit)))
  )
$$;

create or replace function public.can_view_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.project_row_visible(p.id, p.owner_id, p.unit_id, p.status, p.deleted_at)
    from public.projects p where p.id = p_project
  ), false)
$$;

create or replace function public.can_edit_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_user() and exists (
    select 1 from public.projects p
    where p.id = p_project and p.deleted_at is null
      and p.status in ('rascunho', 'em_elaboracao', 'correcao_solicitada')
      and public.project_member_role(p.id) in ('responsavel', 'colaborador')
  )
$$;

create or replace function public.can_execute_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_user() and exists (
    select 1 from public.projects p
    where p.id = p_project and p.deleted_at is null
      and p.status in ('em_execucao', 'concluido', 'prestacao_contas')
      and (public.project_member_role(p.id) in ('responsavel', 'colaborador') or public.has_role('gestor_financeiro', p.unit_id))
  )
$$;

create or replace function public.is_project_reviewer(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and public.project_member_role(p.id) is null and (
      public.has_role('gestor_unidade', p.unit_id) or public.has_role('analista_tecnico', p.unit_id)
      or public.has_role('gestor_financeiro', p.unit_id) or public.is_admin()
    )
  )
$$;

-- ------------------------------------------------------------ habilita RLS em todas as tabelas
do $$
declare t text;
begin
  foreach t in array array[
    'organizational_units', 'profiles', 'user_roles', 'projects', 'project_members', 'project_sections',
    'project_versions', 'project_objectives', 'project_indicators', 'project_budget_items', 'project_schedule',
    'project_risks', 'project_documents', 'project_reviews', 'project_approvals', 'legal_references',
    'funding_sources', 'project_funding_allocations', 'project_expenses', 'project_deliverables',
    'accountability_records', 'audit_logs', 'ai_interactions', 'system_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ------------------------------------------------------------ cadastros
create policy units_select on public.organizational_units for select to authenticated using (public.is_active_user());
create policy units_admin on public.organizational_units for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_select on public.profiles for select to authenticated using (public.is_active_user() or id = auth.uid());
create policy profiles_admin on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy roles_select on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy roles_admin_ins on public.user_roles for insert to authenticated with check (public.is_admin());
create policy roles_admin_del on public.user_roles for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------ projetos
create policy projects_select on public.projects for select to authenticated using (public.project_row_visible(id, owner_id, unit_id, status, deleted_at));
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = auth.uid() and status = 'rascunho'
              and (public.has_role('proponente', unit_id) or public.has_role('gestor_unidade', unit_id)));
create policy projects_update on public.projects for update to authenticated
  using (public.project_row_visible(id, owner_id, unit_id, status, deleted_at)
         and (owner_id = auth.uid() or public.project_member_role(id) = 'colaborador' or public.is_project_reviewer(id)))
  with check (owner_id = auth.uid() or public.project_member_role(id) = 'colaborador' or public.is_project_reviewer(id));

create policy members_select on public.project_members for select to authenticated using (public.can_view_project(project_id));
create policy members_insert on public.project_members for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy members_delete on public.project_members for delete to authenticated
  using (member_role <> 'responsavel' and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- conteúdo técnico: leitura por quem vê; escrita por quem elabora
do $$
declare t text;
begin
  foreach t in array array['project_sections', 'project_objectives', 'project_budget_items', 'project_schedule', 'project_risks'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.can_view_project(project_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.can_edit_project(project_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.can_edit_project(project_id))', t);
  end loop;
end $$;

create policy indicators_select on public.project_indicators for select to authenticated using (public.can_view_project(project_id));
create policy indicators_insert on public.project_indicators for insert to authenticated with check (public.can_edit_project(project_id));
create policy indicators_update on public.project_indicators for update to authenticated
  using (public.can_edit_project(project_id) or public.can_execute_project(project_id))
  with check (public.can_edit_project(project_id) or public.can_execute_project(project_id));
create policy indicators_delete on public.project_indicators for delete to authenticated using (public.can_edit_project(project_id));

create policy versions_select on public.project_versions for select to authenticated using (public.can_view_project(project_id));
create policy versions_insert on public.project_versions for insert to authenticated with check (created_by = auth.uid() and public.can_view_project(project_id));

create policy documents_select on public.project_documents for select to authenticated using (public.can_view_project(project_id));
create policy documents_insert on public.project_documents for insert to authenticated
  with check (uploaded_by = auth.uid() and (
    (context = 'elaboracao' and public.can_edit_project(project_id))
    or (context <> 'elaboracao' and public.can_execute_project(project_id))));
create policy documents_update on public.project_documents for update to authenticated
  using (public.can_view_project(project_id) and (public.project_member_role(project_id) in ('responsavel', 'colaborador') or public.is_project_reviewer(project_id)))
  with check (public.can_view_project(project_id) or deleted_at is not null);

create policy reviews_select on public.project_reviews for select to authenticated using (public.can_view_project(project_id));
create policy reviews_insert on public.project_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and public.can_view_project(project_id) and public.project_member_role(project_id) is null
    and ((review_type = 'gestor_unidade' and public.has_role('gestor_unidade', (select unit_id from public.projects where id = project_id)))
      or (review_type = 'tecnica' and public.has_role('analista_tecnico', (select unit_id from public.projects where id = project_id)))
      or (review_type = 'financeira' and public.has_role('gestor_financeiro', (select unit_id from public.projects where id = project_id)))));

create policy approvals_select on public.project_approvals for select to authenticated using (public.can_view_project(project_id));
create policy approvals_insert on public.project_approvals for insert to authenticated with check (actor_id = auth.uid() and public.can_view_project(project_id));

-- ------------------------------------------------------------ execução
do $$
declare t text;
begin
  foreach t in array array['project_deliverables', 'project_expenses', 'accountability_records'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.can_view_project(project_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.can_execute_project(project_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.can_execute_project(project_id)) with check (public.can_execute_project(project_id))', t);
  end loop;
end $$;
create policy deliverables_delete on public.project_deliverables for delete to authenticated using (public.can_execute_project(project_id));

-- conferência (conferida/conferido) restrita ao gestor financeiro
create or replace function public.enforce_financial_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_unit uuid;
begin
  select unit_id into v_unit from public.projects where id = new.project_id;
  if (tg_table_name = 'project_expenses' and new.status is distinct from old.status and new.status in ('conferida', 'rejeitada'))
     or (tg_table_name = 'accountability_records' and new.status is distinct from old.status and new.status in ('conferido', 'rejeitado')) then
    if not public.has_role('gestor_financeiro', v_unit) then
      raise exception 'Somente o gestor financeiro pode conferir ou rejeitar';
    end if;
  end if;
  return new;
end $$;
create trigger expenses_review before update on public.project_expenses for each row execute function public.enforce_financial_review();
create trigger accountability_review before update on public.accountability_records for each row execute function public.enforce_financial_review();

create policy funding_select on public.funding_sources for select to authenticated using (public.is_active_user());
create policy funding_admin on public.funding_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy allocations_select on public.project_funding_allocations for select to authenticated using (public.can_view_project(project_id));
create policy allocations_write on public.project_funding_allocations for all to authenticated
  using (public.has_role('gestor_financeiro') or public.is_admin()) with check (public.has_role('gestor_financeiro') or public.is_admin());

-- ------------------------------------------------------------ base normativa
create policy legal_select on public.legal_references for select to authenticated using (public.is_active_user());
create policy legal_admin on public.legal_references for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ governança
create policy audit_insert on public.audit_logs for insert to authenticated with check (actor_id = auth.uid());
create policy audit_select on public.audit_logs for select to authenticated using (public.is_admin());
create policy audit_delete on public.audit_logs for delete to authenticated using (public.is_admin());

-- interações de IA: cada usuário vê as próprias; administrador vê todas
create policy ai_select on public.ai_interactions for select to authenticated using ((user_id = auth.uid() and public.can_view_project(project_id)) or public.is_admin());
create policy ai_insert on public.ai_interactions for insert to authenticated with check (user_id = auth.uid() and public.can_edit_project(project_id));
create policy ai_update on public.ai_interactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_delete on public.ai_interactions for delete to authenticated using (public.is_admin());

-- configurações: a identidade visual é pública (tela de login); o resto exige autenticação
create policy settings_public on public.system_settings for select to anon using (id = 'institution');
create policy settings_select on public.system_settings for select to authenticated using (public.is_active_user());
create policy settings_admin on public.system_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ Storage privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-documents', 'project-documents', false, 10485760, array[
  'application/pdf', 'image/png', 'image/jpeg', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false;

-- caminho dos objetos: <project_id>/<document_id>/<arquivo>
create policy storage_select on storage.objects for select to authenticated
  using (bucket_id = 'project-documents' and public.can_view_project(((storage.foldername(name))[1])::uuid));
create policy storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-documents' and (
    public.can_edit_project(((storage.foldername(name))[1])::uuid) or public.can_execute_project(((storage.foldername(name))[1])::uuid)));
