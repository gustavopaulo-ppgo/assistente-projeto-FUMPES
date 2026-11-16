-- Dados iniciais (NÃO contém usuários nem dados reais).
-- As normas são cadastradas como "não verificadas", sem regras ou dispositivos:
-- o administrador deve conferi-las na fonte oficial antes do uso nas análises.

insert into public.organizational_units (name, acronym, city) values
  ('Unidade Prisional Fictícia de Demonstração', 'UP-DEMO', 'Município Exemplo')
on conflict do nothing;

insert into public.funding_sources (name, code, description) values
  ('Fundo Penitenciário Estadual — FUNPES', 'A CONFIRMAR', 'Código da fonte a ser confirmado pela área orçamentária.');

insert into public.legal_references (title, number, date, issuer, official_url, categories) values
  ('Lei Estadual que institui o Fundo Penitenciário Estadual — FUNPES', 'Lei Estadual nº 16.536/2009 (Goiás)', null, 'Estado de Goiás', null, '{funpes,finalidades}'),
  ('Lei de Licitações e Contratos Administrativos', 'Lei Federal nº 14.133/2021', '2021-04-01', 'União', 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm', '{contratacoes}'),
  ('Normas gerais de direito financeiro', 'Lei Federal nº 4.320/1964', '1964-03-17', 'União', 'https://www.planalto.gov.br/ccivil_03/leis/l4320.htm', '{orcamento,natureza_despesa}'),
  ('Lei de Responsabilidade Fiscal', 'Lei Complementar nº 101/2000', '2000-05-04', 'União', 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm', '{orcamento,responsabilidade_fiscal}'),
  ('Lei Geral de Proteção de Dados Pessoais', 'Lei Federal nº 13.709/2018', '2018-08-14', 'União', 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm', '{lgpd}');
