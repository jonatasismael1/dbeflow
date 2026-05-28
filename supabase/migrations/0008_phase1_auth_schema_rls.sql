-- ===========================================================================
-- Fase 1: Supabase Auth, schema canonico dbe_* e RLS transitiva por workspace.
-- Mantem compatibilidade com Functions existentes que ja usam dbe_clients/dbe_scripts.
-- ===========================================================================

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.workspaces (name, slug)
values ('DBE', 'dbe')
on conflict (slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('admin', 'editor')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create or replace function public.dbe_default_workspace_id()
returns uuid
language sql
stable
as $$
  select id from public.workspaces where slug = 'dbe' limit 1
$$;

create or replace function public.dbe_user_is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
$$;

create or replace function public.dbe_current_workspace_id()
returns uuid
language sql
stable
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = auth.uid()
    and wm.status = 'active'
  order by wm.created_at
  limit 1
$$;

create or replace function public.handle_new_dbe_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_role text;
begin
  select public.dbe_default_workspace_id() into v_workspace_id;
  v_role := case
    when lower(new.email) in ('assessoriadbe@gmail.com', 'thayaneluise@gmail.com', 'jonatas.ismael25@gmail.com') then 'admin'
    else 'editor'
  end;

  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  if v_workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (v_workspace_id, new.id, v_role, 'active')
    on conflict (workspace_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_dbe on auth.users;
create trigger on_auth_user_created_dbe
  after insert on auth.users
  for each row execute function public.handle_new_dbe_user();

insert into public.profiles (id, email, full_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
  updated_at = now();

insert into public.workspace_members (workspace_id, user_id, role, status)
select
  public.dbe_default_workspace_id(),
  u.id,
  case
    when lower(u.email) in ('assessoriadbe@gmail.com', 'thayaneluise@gmail.com', 'jonatas.ismael25@gmail.com') then 'admin'
    else 'editor'
  end,
  'active'
from auth.users u
where public.dbe_default_workspace_id() is not null
on conflict (workspace_id, user_id) do nothing;

do $$
declare
  t text;
  legacy text;
begin
  foreach t in array array[
    'dbe_clients','dbe_leads','dbe_scripts','dbe_posts','dbe_invoices',
    'dbe_automations','dbe_contracts','dbe_diagnostics','dbe_briefings'
  ] loop
    execute format('create table if not exists public.%I (
      id uuid primary key default gen_random_uuid(),
      workspace_id uuid references public.workspaces(id) on delete set null,
      data jsonb not null default ''{}''::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );', t);

    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I
      for each row execute function public.set_updated_at();', t);

    legacy := regexp_replace(t, '^dbe_', '');
    if to_regclass('public.' || legacy) is not null then
      execute format('insert into public.%I (id, data, created_at, updated_at)
        select id, coalesce(data, ''{}''::jsonb), created_at, updated_at
        from public.%I
        on conflict (id) do nothing;', t, legacy);
    end if;

    execute format('update public.%I set workspace_id = public.dbe_default_workspace_id() where workspace_id is null;', t);
  end loop;
end $$;

create or replace function public.dbe_set_workspace_id()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is null then
    new.workspace_id := public.dbe_current_workspace_id();
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'dbe_clients','dbe_leads','dbe_scripts','dbe_posts','dbe_invoices',
    'dbe_automations','dbe_contracts','dbe_diagnostics','dbe_briefings'
  ] loop
    execute format('drop trigger if exists dbe_set_workspace_id on public.%I;', t);
    execute format('create trigger dbe_set_workspace_id before insert on public.%I
      for each row execute function public.dbe_set_workspace_id();', t);
  end loop;
end $$;

create or replace function public.dbe_fetch(p_table text)
returns table (id uuid, data jsonb)
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

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','workspace_members','workspaces',
    'dbe_clients','dbe_leads','dbe_scripts','dbe_posts','dbe_invoices',
    'dbe_automations','dbe_contracts','dbe_diagnostics','dbe_briefings'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "dbe_all" on public.%I;', t);
  end loop;
end $$;

create policy "profiles_self" on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "workspaces_member_read" on public.workspaces
  for select to authenticated
  using (public.dbe_user_is_workspace_member(id));

create policy "workspace_members_self_read" on public.workspace_members
  for select to authenticated
  using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'dbe_clients','dbe_leads','dbe_scripts','dbe_posts','dbe_invoices',
    'dbe_automations','dbe_contracts','dbe_diagnostics','dbe_briefings'
  ] loop
    execute format('create policy "workspace_member_access" on public.%I
      for all to authenticated
      using (workspace_id is null or public.dbe_user_is_workspace_member(workspace_id))
      with check (workspace_id is null or public.dbe_user_is_workspace_member(workspace_id));', t);

    execute format('revoke all on public.%I from anon;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $$;

revoke all on public.profiles from anon;
revoke all on public.workspace_members from anon;
revoke all on public.workspaces from anon;
grant select, insert, update on public.profiles to authenticated;
grant select on public.workspace_members to authenticated;
grant select on public.workspaces to authenticated;
grant execute on function public.dbe_fetch(text) to authenticated;
revoke all on function public.dbe_fetch(text) from anon;
