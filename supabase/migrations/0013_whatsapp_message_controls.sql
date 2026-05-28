-- Controles de conversa/mensagem e logs de integração.

alter table public.wa_conversations
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by_email text;

alter table public.wa_messages
  add column if not exists deleted_for_me_at timestamptz,
  add column if not exists deleted_for_me_by_email text,
  add column if not exists deleted_for_all_at timestamptz,
  add column if not exists deleted_by_remote boolean not null default false,
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by_remote boolean not null default false,
  add column if not exists edit_history jsonb not null default '[]'::jsonb,
  add column if not exists action_status text,
  add column if not exists action_error text;

create index if not exists wa_messages_visible_idx
  on public.wa_messages (remote_jid, deleted_for_me_at, ts desc);

create table if not exists public.integration_logs (
  id uuid primary key default gen_random_uuid(),
  integration text not null,
  action text not null,
  status text not null default 'info',
  entity_type text,
  entity_id text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists integration_logs_created_idx
  on public.integration_logs (created_at desc);

create index if not exists integration_logs_integration_idx
  on public.integration_logs (integration, created_at desc);

alter table public.integration_logs enable row level security;

drop policy if exists "authenticated_read_integration_logs" on public.integration_logs;
create policy "authenticated_read_integration_logs" on public.integration_logs
  for select to authenticated
  using (true);

drop policy if exists "authenticated_insert_integration_logs" on public.integration_logs;
create policy "authenticated_insert_integration_logs" on public.integration_logs
  for insert to authenticated
  with check (true);

revoke all on public.integration_logs from anon;
grant select, insert on public.integration_logs to authenticated;
grant all on public.integration_logs to service_role;
