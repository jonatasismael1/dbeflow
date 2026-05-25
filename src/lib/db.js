// ===========================================================================
// Camada de dados do DBE Flow
// - Se o Supabase estiver configurado (.env), persiste na nuvem (multi-device).
// - Senão, cai automaticamente para o localStorage (modo offline/local).
// Cada módulo é uma tabela com coluna JSONB `data`. Aqui convertemos a linha
// { id, data:{...} } para o objeto plano { id, ...data } que o app já usa.
// ===========================================================================
import { supabase, isSupabaseConfigured } from './supabase'

const LOCAL_KEY = 'dbe-flow-state-v1'

// Tabelas "de módulo" (JSONB). A ordem não importa.
export const TABLES = [
  'clients', 'leads', 'scripts', 'posts', 'invoices',
  'automations', 'contracts', 'diagnostics', 'briefings',
]

// Converte linha do banco -> objeto plano usado no app
const fromRow = (row) => ({ id: row.id, ...(row.data || {}) })
// Remove o id de dentro de data (id mora na coluna própria)
const toData = (item) => { const { id, ...rest } = item; return rest }

// ---------- localStorage helpers ----------
function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null') } catch { return null }
}
function writeLocal(state) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)) } catch { /* ignora */ }
}

// ===========================================================================
// loadAll(seed): devolve o estado completo do app
// ===========================================================================
export async function loadAll(seed) {
  if (!isSupabaseConfigured) {
    // Modo local: usa o que estiver salvo, com o seed como base
    const parsed = readLocal()
    return parsed ? { ...seed, ...parsed } : seed
  }

  // Modo nuvem: carrega cada tabela do Supabase (arrays vazios se ainda não há dados)
  const state = { ...seed }
  for (const table of TABLES) state[table] = []
  await Promise.all(TABLES.map(async (table) => {
    const { data, error } = await supabase
      .from(table)
      .select('id, data, created_at')
      .order('created_at', { ascending: false })
    if (error) { console.warn('[db] erro ao carregar', table, error.message); return }
    state[table] = (data || []).map(fromRow)
  }))
  return state
}

// ===========================================================================
// Mutações. No modo LOCAL elas não escrevem nada aqui — o app espelha o estado
// inteiro no localStorage automaticamente (ver useEffect no main.jsx). No modo
// NUVEM, cada mudança vai para o Supabase.
// ===========================================================================
export async function insertItem(table, item) {
  if (!isSupabaseConfigured) return { ...item, id: crypto.randomUUID() }
  const { data, error } = await supabase
    .from(table).insert({ data: toData(item) }).select('id, data').single()
  if (error) { console.warn('[db] insert', table, error.message); return { ...item, id: crypto.randomUUID() } }
  return fromRow(data)
}

export async function saveItem(table, id, fullRecord) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from(table).update({ data: toData(fullRecord) }).eq('id', id)
  if (error) console.warn('[db] update', table, error.message)
}

export async function deleteItem(table, id) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) console.warn('[db] delete', table, error.message)
}

// ===========================================================================
// WhatsApp (somente nuvem) — caixa de entrada
// ===========================================================================
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

// ===========================================================================
// Produção de vídeo (Google Drive)
// ===========================================================================
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
  if (error) console.warn('[db] updateVideoProject', error.message)
}

export async function loadDriveIntegration() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase
    .from('google_drive_integrations')
    .select('google_account_email, status, connected_at, root_folder_id')
    .limit(1)
  return data?.[0] ?? null
}
