-- DBE Flow - modulos importados do DBE Creator:
-- campanhas, aprovacoes, lotes de aprovacao e mapa de mercado.

do $$
declare t text;
begin
  foreach t in array array[
    'dbe_campaigns',
    'dbe_approvals',
    'dbe_approval_batches',
    'dbe_market_maps'
  ] loop
    execute format('create table if not exists public.%I (
      id text primary key default gen_random_uuid()::text,
      workspace_id uuid references public.workspaces(id) on delete set null,
      data jsonb not null default ''{}''::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );', t);

    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I
      for each row execute function public.set_updated_at();', t);

    execute format('drop trigger if exists dbe_set_workspace_id on public.%I;', t);
    execute format('create trigger dbe_set_workspace_id before insert on public.%I
      for each row execute function public.dbe_set_workspace_id();', t);

    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "workspace_member_access" on public.%I;', t);
    execute format('create policy "workspace_member_access" on public.%I
      for all to authenticated
      using (workspace_id is null or public.dbe_user_is_workspace_member(workspace_id))
      with check (workspace_id is null or public.dbe_user_is_workspace_member(workspace_id));', t);

    execute format('revoke all on public.%I from anon;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
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
    'dbe_automations','dbe_contracts','dbe_diagnostics','dbe_briefings',
    'dbe_campaigns','dbe_approvals','dbe_approval_batches','dbe_market_maps'
  ];
begin
  if p_table <> all(allowed) then
    raise exception 'Tabela nao permitida: %', p_table;
  end if;

  return query execute format(
    'select t.id::text, t.data from public.%I t order by t.updated_at desc limit 2000',
    p_table
  );
end;
$$;

grant execute on function public.dbe_fetch(text) to authenticated;
revoke all on function public.dbe_fetch(text) from anon;

create index if not exists dbe_approvals_token_idx on public.dbe_approvals ((data->>'token'));
create index if not exists dbe_approval_batches_token_idx on public.dbe_approval_batches ((data->>'token'));
create index if not exists dbe_campaigns_status_idx on public.dbe_campaigns ((data->>'status'));
