// ===========================================================================
// Camada de dados do DBE Flow
// - Se o Supabase estiver configurado (.env), persiste na nuvem (multi-device).
// - Senao, cai automaticamente para o localStorage (modo offline/local).
// Cada modulo e uma tabela com coluna JSONB `data`.
// ===========================================================================
import { supabase, isSupabaseConfigured } from './supabase'

const LOCAL_KEY = 'dbe-flow-state-v2'

// Fonte canonica usada pelo app e pelas Functions de Drive.
const TABLE_MAP = {
  clients:     'dbe_clients',
  leads:       'dbe_leads',
  scripts:     'dbe_scripts',
  posts:       'dbe_posts',
  invoices:    'dbe_invoices',
  automations: 'dbe_automations',
  contracts:   'dbe_contracts',
  diagnostics: 'dbe_diagnostics',
  briefings:   'dbe_briefings',
  campaigns:   'dbe_campaigns',
  approvals:   'dbe_approvals',
  approvalBatches: 'dbe_approval_batches',
  marketMaps:  'dbe_market_maps',
}

// Fallback somente para bancos que ainda tenham migrations antigas sem prefixo.
const LEGACY_TABLE_MAP = {
  clients:     'clients',
  leads:       'leads',
  scripts:     'scripts',
  posts:       'posts',
  invoices:    'invoices',
  automations: 'automations',
  contracts:   'contracts',
  diagnostics: 'diagnostics',
  briefings:   'briefings',
  campaigns:   'campaigns',
  approvals:   'approvals',
  approvalBatches: 'approval_batches',
  marketMaps:  'market_maps',
}

const CLIENT_SECRET_FIELDS = ['credentials', 'passwords', 'accesses', 'login', 'secret']

export const TABLES = Object.keys(TABLE_MAP)

const fromRow = (row) => ({ id: row.id, ...(row.data || {}) })
const toData = (item) => { const { id, ...rest } = item; return rest }

async function currentAuthUser() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user || null
}

function sanitizeForStorage(key, item) {
  if (key !== 'clients' || !item) return item
  const sanitized = { ...item }
  CLIENT_SECRET_FIELDS.forEach((field) => {
    if (field in sanitized) delete sanitized[field]
  })
  return sanitized
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null') } catch { return null }
}

export async function loadAll(seed) {
  if (!isSupabaseConfigured) {
    const parsed = readLocal()
    return parsed ? { ...seed, ...parsed } : seed
  }

  const state = { ...seed }
  for (const key of TABLES) state[key] = []

  await Promise.all(TABLES.map(async (key) => {
    const table = TABLE_MAP[key]
    const { data, error } = await supabase.rpc('dbe_fetch', { p_table: table })
    if (!error) {
      state[key] = (data || []).map(fromRow).map((item) => sanitizeForStorage(key, item))
      return
    }

    const legacy = LEGACY_TABLE_MAP[key]
    if (!legacy || legacy === table) {
      console.warn('[db] erro ao carregar', table, error.message)
      state[key] = seed[key] || []
      return
    }

    const fallback = await supabase
      .from(legacy)
      .select('id, data')
      .order('updated_at', { ascending: false })
      .limit(2000)

    if (fallback.error) {
      console.warn('[db] erro ao carregar', table, fallback.error.message || error.message)
      state[key] = seed[key] || []
      return
    }

    state[key] = (fallback.data || []).map(fromRow).map((item) => sanitizeForStorage(key, item))
  }))

  return state
}

export async function addActivityLog({ entityType, entityId, action, metadata = {}, actor = null }) {
  if (!isSupabaseConfigured) return null
  const authUser = await currentAuthUser()
  const user = actor || authUser
  const row = {
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    action,
    metadata,
    actor_id: authUser?.id || user?.id || null,
    actor_email: user?.email || authUser?.email || null,
    actor_name: user?.name || user?.user_metadata?.name || user?.user_metadata?.full_name || null,
  }
  const { data, error } = await supabase
    .from('dbe_activity_logs')
    .insert(row)
    .select('*')
    .single()
  if (error) {
    console.warn('[db] addActivityLog', error.message)
    return null
  }
  return data
}

export async function loadActivityLogs(entityType, entityId) {
  if (!isSupabaseConfigured || !entityType || !entityId) return []
  const { data, error } = await supabase
    .from('dbe_activity_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.warn('[db] loadActivityLogs', error.message)
    return []
  }
  return data || []
}

export async function loadContentComments(entityType, entityId) {
  if (!isSupabaseConfigured || !entityType || !entityId) return []
  const { data, error } = await supabase
    .from('dbe_content_comments')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) {
    console.warn('[db] loadContentComments', error.message)
    return []
  }
  return data || []
}

export async function addContentComment({ entityType, entityId, body, author = null }) {
  if (!isSupabaseConfigured) {
    return {
      id: crypto.randomUUID(),
      entity_type: entityType,
      entity_id: String(entityId),
      body,
      author_name: author?.name || 'DBE',
      author_email: author?.email || null,
      created_at: new Date().toISOString(),
    }
  }
  const authUser = await currentAuthUser()
  const user = author || authUser
  const row = {
    entity_type: entityType,
    entity_id: String(entityId),
    body,
    author_id: authUser?.id || user?.id || null,
    author_email: user?.email || authUser?.email || null,
    author_name: user?.name || user?.user_metadata?.name || user?.user_metadata?.full_name || null,
  }
  const { data, error } = await supabase
    .from('dbe_content_comments')
    .insert(row)
    .select('*')
    .single()
  if (error) {
    console.warn('[db] addContentComment', error.message)
    throw new Error(error.message || 'Falha ao salvar comentario')
  }
  await addActivityLog({
    entityType,
    entityId,
    action: 'comment',
    metadata: { comment_id: data.id },
    actor: author,
  })
  return data
}

export async function loadEntityFiles(entityType, entityId) {
  if (!isSupabaseConfigured || !entityType || !entityId) return []
  const { data, error } = await supabase
    .from('dbe_entity_files')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    console.warn('[db] loadEntityFiles', error.message)
    return []
  }
  return data || []
}

export async function addEntityFile({ entityType, entityId, file, stage = '', source = 'manual', metadata = {}, author = null }) {
  const now = new Date().toISOString()
  const fallback = {
    id: crypto.randomUUID(),
    entity_type: entityType,
    entity_id: String(entityId),
    file_name: file?.name || file?.file_name || 'Arquivo',
    file_url: file?.url || file?.file_url || '',
    mime_type: file?.mimeType || file?.mime_type || '',
    size_bytes: file?.size || file?.size_bytes || null,
    drive_file_id: file?.id || file?.drive_file_id || null,
    stage,
    source,
    metadata,
    created_at: now,
  }
  if (!isSupabaseConfigured) return fallback
  const authUser = await currentAuthUser()
  const user = author || authUser
  const row = {
    entity_type: entityType,
    entity_id: String(entityId),
    file_name: fallback.file_name,
    file_url: fallback.file_url,
    mime_type: fallback.mime_type,
    size_bytes: fallback.size_bytes,
    drive_file_id: fallback.drive_file_id,
    stage,
    source,
    metadata,
    uploaded_by: authUser?.id || user?.id || null,
    uploaded_by_email: user?.email || authUser?.email || null,
  }
  const { data, error } = await supabase
    .from('dbe_entity_files')
    .insert(row)
    .select('*')
    .single()
  if (error) {
    console.warn('[db] addEntityFile', error.message)
    throw new Error(error.message || 'Falha ao salvar arquivo')
  }
  await addActivityLog({
    entityType,
    entityId,
    action: 'file_upload',
    metadata: { file_id: data.id, file_name: data.file_name, stage },
    actor: author,
  })
  return data
}

export async function insertItem(key, item) {
  const clean = sanitizeForStorage(key, item)
  if (!isSupabaseConfigured) return { ...clean, id: clean.id || crypto.randomUUID() }

  const table = TABLE_MAP[key] || key
  const id = clean.id || crypto.randomUUID()
  const { data, error } = await supabase
    .from(table)
    .insert({ id, data: toData(clean) })
    .select('id, data')
    .single()

  if (error) {
    console.warn('[db] insert', table, error.message)
    throw new Error(error.message || `Falha ao criar registro em ${table}`)
  }

  return fromRow(data)
}

export async function saveItem(key, id, fullRecord) {
  if (!isSupabaseConfigured) return
  const clean = sanitizeForStorage(key, fullRecord)
  const table = TABLE_MAP[key] || key
  const { error } = await supabase.from(table).update({ data: toData(clean) }).eq('id', id)
  if (error) {
    console.warn('[db] update', table, error.message)
    throw new Error(error.message || `Falha ao salvar registro em ${table}`)
  }
}

export async function deleteItem(key, id) {
  if (!isSupabaseConfigured) return
  const table = TABLE_MAP[key] || key
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) {
    console.warn('[db] delete', table, error.message)
    throw new Error(error.message || `Falha ao excluir registro em ${table}`)
  }
}

export async function loadConversations() {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('wa_conversations').select('*').order('last_at', { ascending: false }).limit(200)
  return data || []
}

export async function loadMessages(remoteJid) {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('wa_messages').select('*').eq('remote_jid', remoteJid).order('ts', { ascending: true }).limit(500)
  return data || []
}

export async function loadVideoProjects(clientId) {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('video_projects')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function loadVideoProjectFiles(videoProjectId) {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('video_project_files')
    .select('*')
    .eq('video_project_id', videoProjectId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function updateVideoProject(id, patch) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('video_projects').update(patch).eq('id', id)
  if (error) {
    console.warn('[db] updateVideoProject', error.message)
    throw new Error(error.message || 'Falha ao salvar projeto de video')
  }
}

export async function loadDriveIntegration() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase
    .from('google_drive_integrations')
    .select('google_account_email, status, connected_at, root_folder_id')
    .limit(1)
  return data?.[0] ?? null
}
