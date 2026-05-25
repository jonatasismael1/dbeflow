-- ===========================================================================
-- DBE FLOW — Schema inicial
-- Estratégia: cada módulo do app vira uma tabela com uma coluna JSONB `data`,
-- guardando o registro inteiro. Isso deixa o app evoluir sem quebrar o banco
-- (o front usa os mesmos objetos que já usava). Campos comuns (id/created_at/
-- updated_at) ficam em colunas próprias para ordenação e auditoria.
--
-- Segurança: RLS LIGADO em tudo. Por enquanto as policies são permissivas
-- (uso interno da agência com a anon key). Quando virar SaaS multi-cliente,
-- troque as policies por regras com workspace_id + auth.uid().
-- ===========================================================================

-- Função utilitária: mantém updated_at sempre atual
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Macro: cria uma tabela "de módulo" baseada em JSONB com RLS permissiva
-- (executada manualmente abaixo para cada módulo — Postgres não tem macro,
--  então repetimos o padrão de forma explícita e legível)
-- ---------------------------------------------------------------------------

-- CLIENTES (carteira de clientes da agência)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- LEADS (CRM comercial / pipeline)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ROTEIROS (conteúdo)
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- POSTS (Instagram Studio / esteira de conteúdo)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FATURAS (financeiro)
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AUTOMAÇÕES
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CONTRATOS
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- DIAGNÓSTICOS (respostas do funil de posicionamento)
create table if not exists public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- BRIEFINGS (onboarding / jornadas)
create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- WHATSAPP (Evolution API) — tabelas tipadas, alimentadas pelo webhook
-- ---------------------------------------------------------------------------

-- Contatos do WhatsApp
create table if not exists public.wa_contacts (
  id uuid primary key default gen_random_uuid(),
  remote_jid text unique not null,         -- ex: 5582999999999@s.whatsapp.net
  phone text,
  name text,
  push_name text,
  profile_pic text,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Conversas (uma por contato) — usada para a caixa de entrada
create table if not exists public.wa_conversations (
  id uuid primary key default gen_random_uuid(),
  remote_jid text unique not null,
  name text,
  last_message text,
  last_at timestamptz,
  unread int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mensagens
create table if not exists public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  wa_message_id text unique,               -- id da mensagem na Evolution (idempotência)
  remote_jid text not null,
  from_me boolean not null default false,
  message_type text default 'text',
  content text,
  status text,                             -- sent, delivered, read...
  ts timestamptz not null default now(),
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists wa_messages_jid_ts_idx on public.wa_messages (remote_jid, ts desc);

-- ---------------------------------------------------------------------------
-- CONFIGURAÇÕES / INTEGRAÇÕES (chave-valor)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- LOG DE IA (auditoria de chamadas à Deby)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  feature text,
  model text,
  prompt text,
  response text,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- Triggers de updated_at
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'clients','leads','scripts','posts','invoices','automations',
    'contracts','diagnostics','briefings','wa_contacts','wa_conversations'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ===========================================================================
-- RLS + policies permissivas (uso interno) + grants
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'clients','leads','scripts','posts','invoices','automations',
    'contracts','diagnostics','briefings','wa_contacts','wa_conversations',
    'wa_messages','settings','ai_logs'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "dbe_all" on public.%I;', t);
    execute format('create policy "dbe_all" on public.%I for all to anon, authenticated using (true) with check (true);', t);
    execute format('grant all on table public.%I to anon, authenticated;', t);
  end loop;
end $$;
