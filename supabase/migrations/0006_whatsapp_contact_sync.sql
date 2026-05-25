-- Sincronizacao de contatos existentes da Evolution.

alter table public.wa_conversations
  add column if not exists profile_pic text;

create index if not exists wa_contacts_phone_idx
  on public.wa_contacts (phone);

