// Helper compartilhado para as funções do Google Drive.
// Nunca é exposto ao frontend — roda apenas nas Netlify Functions (servidor).
import { createHmac, randomBytes } from 'node:crypto'

// ── Variáveis de ambiente ─────────────────────────────────────────────────────
export const SB_URL = process.env.SUPABASE_URL
export const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
export const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
export const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
export const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  'https://dbeflow.netlify.app/.netlify/functions/google-drive-callback'
export const ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1-rHJ3bfsx4mvG6xXTpKiCtn1a1_R1Gg0'
const STATE_SECRET = process.env.OAUTH_STATE_SECRET || 'dbe-drive-state-dev'

export const DRIVE_API = 'https://www.googleapis.com/drive/v3'
export const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export const sbHeaders = {
  'Content-Type': 'application/json',
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
}

// ── CSRF State (HMAC-SHA256, expira em 15 min) ────────────────────────────────

export function generateState() {
  const nonce = randomBytes(16).toString('hex')
  const ts = Date.now().toString()
  const payload = `${nonce}|${ts}`
  const sig = createHmac('sha256', STATE_SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}|${sig}`).toString('base64url')
}

export function validateState(state) {
  if (!state) return false
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const [nonce, ts, sig] = decoded.split('|')
    if (!nonce || !ts || !sig) return false
    const payload = `${nonce}|${ts}`
    const expected = createHmac('sha256', STATE_SECRET).update(payload).digest('hex')
    if (sig !== expected) return false
    if (Date.now() - Number(ts) > 15 * 60 * 1000) return false
    return true
  } catch { return false }
}

// ── Gerenciamento de tokens ───────────────────────────────────────────────────

export async function getIntegration() {
  const res = await fetch(
    `${SB_URL}/rest/v1/google_drive_integrations?select=*&limit=1`,
    { headers: sbHeaders },
  )
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? (rows[0] ?? null) : null
}

async function doRefresh(integration) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: integration.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'Erro ao renovar token Google')
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
  await fetch(
    `${SB_URL}/rest/v1/google_drive_integrations?id=eq.${integration.id}`,
    {
      method: 'PATCH',
      headers: sbHeaders,
      body: JSON.stringify({ access_token: data.access_token, expires_at: expiresAt }),
    },
  )
  return data.access_token
}

export async function getValidToken() {
  const integration = await getIntegration()
  if (!integration) throw new Error('Google Drive não conectado. Acesse Integrações para conectar.')
  // Renova se expira em menos de 5 minutos
  const margin = 5 * 60 * 1000
  if (!integration.expires_at || new Date(integration.expires_at) - Date.now() < margin) {
    return doRefresh(integration)
  }
  return integration.access_token
}

// ── Drive API ────────────────────────────────────────────────────────────────

export async function driveReq(path, options = {}, token = null) {
  const accessToken = token ?? (await getValidToken())
  const url = path.startsWith('http') ? path : `${DRIVE_API}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// Cria uma pasta no Drive e retorna { id, name }
export async function createDriveFolder(name, parentId, token = null) {
  const { ok, data } = await driveReq(
    '/files',
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    },
    token,
  )
  if (!ok) throw new Error(data.error?.message || `Erro ao criar pasta "${name}"`)
  return data
}

// Concede leitura pública para qualquer pessoa com o link
export async function setPublicRead(fileId, token = null) {
  const accessToken = token ?? (await getValidToken())
  await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
  }).catch((e) => console.warn('[drive] setPublicRead', e.message))
}

// Inicia uma sessão de upload resumable e retorna a URI de upload.
// O frontend faz o PUT direto para essa URI sem precisar do access_token.
export async function initResumableUpload(fileName, mimeType, folderId, token = null) {
  const accessToken = token ?? (await getValidToken())
  const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': mimeType || 'application/octet-stream',
    },
    body: JSON.stringify({ name: fileName, parents: [folderId] }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Erro ao iniciar sessão de upload')
  }
  return res.headers.get('Location')
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

export function driveUrl(folderId) {
  return `https://drive.google.com/drive/folders/${folderId}`
}

export function fileUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`
}

// ── Logs de auditoria ─────────────────────────────────────────────────────────

export function logDrive(action, entityType, entityId, details, userInfo = 'sistema') {
  fetch(`${SB_URL}/rest/v1/drive_logs`, {
    method: 'POST',
    headers: sbHeaders,
    body: JSON.stringify({
      action,
      entity_type: entityType,
      entity_id: String(entityId ?? ''),
      user_info: userInfo,
      details,
    }),
  }).catch(() => {})
}

// ── Resposta JSON padrão ──────────────────────────────────────────────────────
export const jsonRes = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
