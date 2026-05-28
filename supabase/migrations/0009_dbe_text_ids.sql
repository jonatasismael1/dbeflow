-- IDs importados do legado usam chaves textuais (ex.: c_2cdb84ff).
-- As tabelas dbe_* precisam preservar esses IDs para nao quebrar vinculos.

do $$
declare t text;
begin
  foreach t in array array[
    'dbe_clients','dbe_leads','dbe_scripts','dbe_posts','dbe_invoices',
    'dbe_automations','dbe_contracts','dbe_diagnostics','dbe_briefings'
  ] loop
    execute format('alter table public.%I alter column id drop default;', t);
    execute format('alter table public.%I alter column id type text using id::text;', t);
    execute format('alter table public.%I alter column id set default gen_random_uuid()::text;', t);
  end loop;
end $$;

drop function if exists public.dbe_fetch(text);

create function public.dbe_fetch(p_table text)
returns table (id text, data jsonb)
language plpgsql
security invoker
as $$
declare
  allowed text[] := array[
    'dbe_clients','dbe_leads','dbe_scripts','dbe_posts','dbe_invoices',
    'dbe_automations','dbe_contracts','dbe_diagnostics','dbe_briefings'
  ];
begin
  if p_table <> all(allowed) then
    raise exception 'Tabela nao permitida: %', p_table;
  end if;

  return query execute format(
    'select t.id, t.data from public.%I t order by t.updated_at desc limit 2000',
    p_table
  );
end;
$$;

grant execute on function public.dbe_fetch(text) to authenticated;
revoke all on function public.dbe_fetch(text) from anon;
