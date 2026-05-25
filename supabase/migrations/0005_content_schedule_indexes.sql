-- Cronograma de Conteudo usa a tabela scripts como entidade unica de conteudo.
-- Estes indices aceleram filtros por cliente, formato, status, responsavel e datas.

create index if not exists scripts_client_id_idx
  on public.scripts ((data->>'client_id'));

create index if not exists scripts_client_name_idx
  on public.scripts ((data->>'client'));

create index if not exists scripts_format_idx
  on public.scripts ((data->>'format'));

create index if not exists scripts_status_idx
  on public.scripts ((data->>'status'));

create index if not exists scripts_responsible_idx
  on public.scripts ((data->>'responsible'));

create index if not exists scripts_delivery_date_idx
  on public.scripts ((data->>'delivery_date'));

create index if not exists scripts_post_date_idx
  on public.scripts ((data->>'post_date'));

