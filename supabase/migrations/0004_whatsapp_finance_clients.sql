-- Ajustes para conversas reais da Evolution e vinculo cliente-financeiro.

alter table public.wa_messages
  add column if not exists media_url text,
  add column if not exists media_mime text;

create index if not exists wa_conversations_last_at_idx
  on public.wa_conversations (last_at desc);

create index if not exists invoices_client_id_idx
  on public.invoices ((data->>'client_id'));

