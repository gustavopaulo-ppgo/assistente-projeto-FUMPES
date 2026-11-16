-- Promove o primeiro usuário a administrador (executar no SQL Editor do Supabase,
-- como proprietário do banco, APÓS o usuário aceitar o convite e acessar uma vez).
-- Substitua o e-mail abaixo.

insert into public.user_roles (user_id, role, unit_id)
select id, 'administrador', null
from public.profiles
where email = lower('substitua.pelo.email@instituicao.gov.br')
on conflict do nothing;
