-- Arquivos/anexos estruturados por entidade.

create table if not exists public.dbe_entity_files (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  file_name text not null,
  file_url text,
  drive_file_id text,
  mime_type text,
  size_bytes bigint,
  stage text,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_by_email text,
  created_at timestamptz not null default now()
);

drop trigger if exists dbe_set_workspace_id on public.dbe_entity_files;
create trigger dbe_set_workspace_id before insert on public.dbe_entity_files
  for each row execute function public.dbe_set_workspace_id();

create index if not exists dbe_entity_files_entity_idx
  on public.dbe_entity_files (entity_type, entity_id, created_at desc);

create index if not exists dbe_entity_files_stage_idx
  on public.dbe_entity_files (entity_type, stage);

alter table public.dbe_entity_files enable row level security;

drop policy if exists "workspace_member_access" on public.dbe_entity_files;
create policy "workspace_member_access" on public.dbe_entity_files
  for all to authenticated
  using (workspace_id is null or public.dbe_user_is_workspace_member(workspace_id))
  with check (workspace_id is null or public.dbe_user_is_workspace_member(workspace_id));

revoke all on public.dbe_entity_files from anon;
grant select, insert, update, delete on public.dbe_entity_files to authenticated;
