-- Instagram Analytics por cliente (Meta / Instagram Graph API).
-- Tokens ficam somente no backend e sao acessados via service_role nas Netlify Functions.

create table if not exists public.instagram_integrations (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  user_id text not null,
  provider text not null default 'meta',
  instagram_user_id text not null,
  instagram_username text,
  access_token text not null,
  token_expires_at timestamptz,
  status text not null default 'active',
  is_active boolean not null default true,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_media_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  instagram_integration_id uuid not null references public.instagram_integrations(id) on delete cascade,
  media_id text not null,
  media_type text,
  caption text,
  permalink text,
  "timestamp" timestamptz,
  reach bigint not null default 0,
  views bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  saves bigint not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_media_metrics_unique unique (instagram_integration_id, media_id)
);

create table if not exists public.instagram_account_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  instagram_integration_id uuid not null references public.instagram_integrations(id) on delete cascade,
  metric_date date not null,
  reach bigint not null default 0,
  views bigint not null default 0,
  follower_count bigint not null default 0,
  profile_views bigint not null default 0,
  website_clicks bigint not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint instagram_account_metrics_unique unique (instagram_integration_id, metric_date)
);

create index if not exists instagram_integrations_client_active_idx
  on public.instagram_integrations (client_id, is_active);

create index if not exists instagram_media_metrics_client_timestamp_idx
  on public.instagram_media_metrics (client_id, "timestamp" desc);

create index if not exists instagram_account_metrics_client_date_idx
  on public.instagram_account_metrics (client_id, metric_date desc);

drop trigger if exists set_updated_at_instagram_integrations on public.instagram_integrations;
create trigger set_updated_at_instagram_integrations
  before update on public.instagram_integrations
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_instagram_media_metrics on public.instagram_media_metrics;
create trigger set_updated_at_instagram_media_metrics
  before update on public.instagram_media_metrics
  for each row execute function public.set_updated_at();

alter table public.instagram_integrations enable row level security;
alter table public.instagram_media_metrics enable row level security;
alter table public.instagram_account_metrics enable row level security;

-- Nenhuma policy para anon/authenticated: a UI consome dados sanitizados via Functions.
revoke all on public.instagram_integrations from anon, authenticated;
revoke all on public.instagram_media_metrics from anon, authenticated;
revoke all on public.instagram_account_metrics from anon, authenticated;

grant all on public.instagram_integrations to service_role;
grant all on public.instagram_media_metrics to service_role;
grant all on public.instagram_account_metrics to service_role;
