-- Comentarios persistidos e historico de alteracoes por entidade.

create table if not exists public.dbe_content_comments (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  entity_type text not null default 'scripts',
  entity_id text not null,
  body text not null,
  author_id uuid references auth.users(id) on delete set null,
  author_email text,
  author_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.dbe_activity_logs (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_name text,
  created_at timestamptz not null default now()
);

drop trigger if exists dbe_set_workspace_id on public.dbe_content_comments;
create trigger dbe_set_workspace_id before insert on public.dbe_content_comments
  for each row execute function public.dbe_set_workspace_id();

drop trigger if exists dbe_set_workspace_id on public.dbe_activity_logs;
create trigger dbe_set_workspace_id before insert on public.dbe_activity_logs
  for each row execute function public.dbe_set_workspace_id();

create index if not exists dbe_content_comments_entity_idx
  on public.dbe_content_comments (entity_type, entity_id, created_at desc);

create index if not exists dbe_activity_logs_entity_idx
  on public.dbe_activity_logs (entity_type, entity_id, created_at desc);

create index if not exists dbe_activity_logs_created_idx
  on public.dbe_activity_logs (created_at desc);

alter table public.dbe_content_comments enable row level security;
alter table public.dbe_activity_logs enable row level security;

drop policy if exists "workspace_member_access" on public.dbe_content_comments;
create policy "workspace_member_access" on public.dbe_content_comments
  for all to authenticated
  using (workspace_id is null or public.dbe_user_is_workspace_member(workspace_id))
  with check (workspace_id is null or public.dbe_user_is_workspace_member(workspace_id));

drop policy if exists "workspace_member_access" on public.dbe_activity_logs;
create policy "workspace_member_access" on public.dbe_activity_logs
  for all to authenticated
  using (workspace_id is null or public.dbe_user_is_workspace_member(workspace_id))
  with check (workspace_id is null or public.dbe_user_is_workspace_member(workspace_id));

revoke all on public.dbe_content_comments from anon;
revoke all on public.dbe_activity_logs from anon;
grant select, insert, update, delete on public.dbe_content_comments to authenticated;
grant select, insert on public.dbe_activity_logs to authenticated;
