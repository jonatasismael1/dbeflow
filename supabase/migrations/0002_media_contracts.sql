-- Adiciona suporte a mídia nas mensagens WhatsApp
ALTER TABLE wa_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_mime TEXT;

-- Corrige message_type para registrar tipo real da mídia
-- (já existe, só garantindo que não seja NOT NULL para retrocompatibilidade)

-- Tabela de contratos gerados (armazena metadados + URL do DOCX)
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS docx_url TEXT,
  ADD COLUMN IF NOT EXISTS sent_via_whatsapp BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Bucket de storage: criado via API (não SQL), mas registramos aqui pro histórico
-- Bucket: dbe-docs (contratos, documentos)
-- Bucket: wa-media  (fotos, vídeos, áudios recebidos no WhatsApp)
