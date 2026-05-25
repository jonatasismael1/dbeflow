-- ============================================================
-- 0003 – Google Drive integration + produção de vídeo
-- ============================================================

-- Integração OAuth Google Drive (sempre 1 linha por agência)
CREATE TABLE IF NOT EXISTS google_drive_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton_key TEXT UNIQUE DEFAULT 'default',  -- garante no máximo 1 linha
  google_account_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ,
  root_folder_id TEXT,
  status TEXT DEFAULT 'active',
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projetos de vídeo por cliente
CREATE TABLE IF NOT EXISTS video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,            -- FK soft para clients.id
  client_name TEXT,          -- denormalizado para exibição rápida
  title TEXT NOT NULL,
  recording_date DATE,
  notes TEXT,
  status TEXT DEFAULT 'gravado',
  drive_folder_id TEXT,
  drive_folder_url TEXT,
  raw_folder_id TEXT,
  project_folder_id TEXT,
  final_folder_id TEXT,
  created_by TEXT DEFAULT 'sistema',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Arquivos enviados para cada projeto
CREATE TABLE IF NOT EXISTS video_project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_project_id UUID NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
  drive_file_id TEXT,
  drive_folder_id TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size BIGINT,
  category TEXT DEFAULT 'bruto', -- bruto | projeto | final
  file_url TEXT,
  uploaded_by TEXT DEFAULT 'sistema',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de ações (auditoria)
CREATE TABLE IF NOT EXISTS drive_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  user_info TEXT DEFAULT 'sistema',
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers de updated_at
CREATE TRIGGER set_updated_at_drive_integration
  BEFORE UPDATE ON google_drive_integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_video_projects
  BEFORE UPDATE ON video_projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS permissiva (interno da agência — trocar por workspace+auth ao virar SaaS)
ALTER TABLE google_drive_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dbe_all" ON google_drive_integrations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dbe_all" ON video_projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dbe_all" ON video_project_files FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dbe_all" ON drive_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT ALL ON google_drive_integrations TO anon, authenticated;
GRANT ALL ON video_projects TO anon, authenticated;
GRANT ALL ON video_project_files TO anon, authenticated;
GRANT ALL ON drive_logs TO anon, authenticated;
