import { createHmac, randomBytes, timingSafeEqual as safeCompare } from 'node:crypto'

export const GRAPH_VERSION = env('META_GRAPH_API_VERSION') || 'v25.0'
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`
export const APP_ID = env('META_APP_ID')
export const APP_SECRET = env('META_APP_SECRET')
export const APP_URL = (env('APP_URL') || env('VITE_APP_URL') || 'http://127.0.0.1:8888').replace(/\/$/, '')
export const REDIRECT_URI =
  env('META_REDIRECT_URI') || `${APP_URL}/.netlify/functions/meta-instagram-callback`
export const STATE_SECRET = env('OAUTH_STATE_SECRET') || env('META_OAUTH_STATE_SECRET') || 'dbe-meta-state-dev'
export const SUPABASE_URL = env('SUPABASE_URL')
export const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
export const CLIENTS_TABLE = env('DBE_CLIENTS_TABLE') || 'dbe_clients'
export const META_SCOPES = (env('META_INSTAGRAM_SCOPES') ||
  'instagram_basic,instagram_manage_insights,pages_read_engagement').split(',').map((scope) => scope.trim()).filter(Boolean)

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export function env(name) {
  return globalThis.Netlify?.env?.get?.(name) || process.env[name]
}

export function assertServerConfig() {
  const missing = []
  if (!APP_ID) missing.push('META_APP_ID')
  if (!APP_SECRET) missing.push('META_APP_SECRET')
  if (!SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (missing.length) throw new Error(`Variaveis ausentes: ${missing.join(', ')}`)
}

export function normalizeUser(input = {}) {
  const user = input.user || input.currentUser || {}
  const email = String(user.email || input.user_email || '').trim().toLowerCase()
  const id = String(user.id || user.user_id || email || input.user_id || '').trim()
  const role = String(user.role || input.user_role || '').trim().toLowerCase()
  return { id, email, role }
}

export function requireUser(user) {
  if (!user?.id && !user?.email) throw new Error('Usuario nao informado.')
}

export function buildState(payload) {
  const body = {
    ...payload,
    nonce: randomBytes(16).toString('hex'),
    ts: Date.now(),
  }
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = createHmac('sha256', STATE_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

export function parseState(state) {
  if (!state || !state.includes('.')) throw new Error('State OAuth ausente.')
  const [encoded, sig] = state.split('.')
  const expected = createHmac('sha256', STATE_SECRET).update(encoded).digest('base64url')
  if (!timingSafeEqual(sig, expected)) throw new Error('State OAuth invalido.')
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  if (!payload.ts || Date.now() - Number(payload.ts) > 15 * 60 * 1000) {
    throw new Error('State OAuth expirado.')
  }
  return payload
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (left.length !== right.length) return false
  return safeCompare(left, right)
}

export function appSecretProof(accessToken) {
  return createHmac('sha256', APP_SECRET).update(accessToken).digest('hex')
}

export function metaAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    state,
    response_type: 'code',
    scope: META_SCOPES.join(','),
  })
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`
}

export async function graphGet(path, accessToken, params = {}) {
  const query = new URLSearchParams({
    ...params,
    access_token: accessToken,
    appsecret_proof: appSecretProof(accessToken),
  })
  const url = `${GRAPH_BASE}${path.startsWith('/') ? path : `/${path}`}?${query}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Meta Graph API HTTP ${res.status}`)
  }
  return data
}

export async function exchangeCode(code) {
  const shortParams = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  })
  const shortRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${shortParams}`)
  const shortData = await shortRes.json().catch(() => ({}))
  if (!shortRes.ok || shortData.error || !shortData.access_token) {
    throw new Error(shortData.error?.message || 'Falha ao trocar code por token Meta.')
  }

  const longParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: shortData.access_token,
  })
  const longRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${longParams}`)
  const longData = await longRes.json().catch(() => ({}))
  if (!longRes.ok || longData.error || !longData.access_token) {
    throw new Error(longData.error?.message || 'Falha ao gerar token Meta de longa duracao.')
  }
  return longData
}

export async function getInstagramAccounts(accessToken) {
  const fields = [
    'id',
    'name',
    'access_token',
    'instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}',
  ].join(',')
  const data = await graphGet('/me/accounts', accessToken, { fields, limit: '100' })
  return (data.data || []).filter((page) => page.instagram_business_account?.id)
}

export async function fetchClient(clientId) {
  const safeId = encodeURIComponent(clientId)
  const tables = [...new Set([CLIENTS_TABLE, 'dbe_clients', 'clients'])]
  for (const table of tables) {
    const rows = await sbGet(table, `id=eq.${safeId}&select=id,data&limit=1`).catch(() => null)
    if (Array.isArray(rows) && rows[0]) return { table, row: rows[0] }
  }
  return null
}

export async function assertClientAccess(clientId, user) {
  if (!clientId) throw new Error('client_id obrigatorio.')
  requireUser(user)
  if (user.role === 'admin') return { table: null, row: { id: clientId, data: {} } }
  const client = await fetchClient(clientId)
  if (!client) throw new Error('Cliente nao encontrado.')

  const data = client.row?.data || {}
  const allowed = [
    data.user_id,
    data.user_email,
    data.owner_email,
    ...(Array.isArray(data.allowed_users) ? data.allowed_users : []),
  ].filter(Boolean).map((value) => String(value).toLowerCase())

  if (allowed.includes(String(user.id).toLowerCase()) || allowed.includes(user.email)) return client
  const error = new Error('Usuario sem permissao para este cliente.')
  error.status = 403
  throw error
}

export async function getActiveIntegration(clientId, includeToken = false) {
  const select = includeToken ? '*' : sanitizedIntegrationSelect()
  const rows = await sbGet(
    'instagram_integrations',
    `client_id=eq.${encodeURIComponent(clientId)}&is_active=eq.true&provider=eq.meta&select=${select}&order=connected_at.desc&limit=1`,
  )
  return rows?.[0] || null
}

export function sanitizeIntegration(row) {
  if (!row) return null
  const { access_token, ...safe } = row
  return safe
}

export function sanitizedIntegrationSelect() {
  return 'id,client_id,user_id,provider,instagram_user_id,instagram_username,token_expires_at,status,is_active,connected_at,disconnected_at,last_sync_at,created_at,updated_at'
}

export async function dashboardPayload(clientId) {
  const integration = await getActiveIntegration(clientId, false)
  if (!integration) {
    return { integration: null, accountMetrics: [], mediaMetrics: [], totals: emptyTotals() }
  }
  const [accountMetrics, mediaMetrics] = await Promise.all([
    sbGet(
      'instagram_account_metrics',
      `client_id=eq.${encodeURIComponent(clientId)}&instagram_integration_id=eq.${integration.id}&select=*&order=metric_date.asc&limit=90`,
    ),
    sbGet(
      'instagram_media_metrics',
      `client_id=eq.${encodeURIComponent(clientId)}&instagram_integration_id=eq.${integration.id}&select=*&order=timestamp.desc&limit=50`,
    ),
  ])
  return {
    integration,
    accountMetrics: accountMetrics || [],
    mediaMetrics: mediaMetrics || [],
    totals: buildTotals(accountMetrics || [], mediaMetrics || []),
  }
}

export function buildTotals(accountRows, mediaRows) {
  const latest = [...accountRows].sort((a, b) => String(b.metric_date).localeCompare(String(a.metric_date)))[0] || {}
  return {
    reach: sum(accountRows, 'reach') || sum(mediaRows, 'reach'),
    views: sum(accountRows, 'views') || sum(mediaRows, 'views'),
    followers: Number(latest.follower_count || 0),
    profileViews: sum(accountRows, 'profile_views'),
    websiteClicks: sum(accountRows, 'website_clicks'),
    likes: sum(mediaRows, 'likes'),
    comments: sum(mediaRows, 'comments'),
    shares: sum(mediaRows, 'shares'),
    saves: sum(mediaRows, 'saves'),
  }
}

export function emptyTotals() {
  return { reach: 0, views: 0, followers: 0, profileViews: 0, websiteClicks: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0)
}

export async function syncAccountMetrics(integration) {
  const token = integration.access_token
  const igUserId = integration.instagram_user_id
  const profile = await graphGet(`/${igUserId}`, token, {
    fields: 'id,username,name,profile_picture_url,followers_count,media_count',
  })
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const until = new Date().toISOString().slice(0, 10)
  const insights = await collectInsightMetrics(igUserId, token, ['reach', 'views', 'profile_views', 'website_clicks'], {
    period: 'day',
    since,
    until,
  })

  const rowsByDate = new Map()
  for (const [metric, points] of Object.entries(insights)) {
    for (const point of points) {
      const date = String(point.end_time || until).slice(0, 10)
      const row = rowsByDate.get(date) || {
        client_id: integration.client_id,
        instagram_integration_id: integration.id,
        metric_date: date,
        reach: 0,
        views: 0,
        follower_count: 0,
        profile_views: 0,
        website_clicks: 0,
        raw_data: {},
      }
      row[metric] = numberValue(point.value)
      row.raw_data[metric] = point
      rowsByDate.set(date, row)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayRow = rowsByDate.get(today) || {
    client_id: integration.client_id,
    instagram_integration_id: integration.id,
    metric_date: today,
    reach: 0,
    views: 0,
    follower_count: 0,
    profile_views: 0,
    website_clicks: 0,
    raw_data: {},
  }
  todayRow.follower_count = Number(profile.followers_count || 0)
  todayRow.raw_data.profile = profile
  rowsByDate.set(today, todayRow)

  const rows = Array.from(rowsByDate.values())
  if (rows.length) {
    await sbUpsert('instagram_account_metrics', rows, 'instagram_integration_id,metric_date')
  }
  await sbPatch('instagram_integrations', `id=eq.${integration.id}`, {
    instagram_username: profile.username || integration.instagram_username,
    last_sync_at: new Date().toISOString(),
    status: 'active',
  })
  return rows
}

export async function syncMediaMetrics(integration) {
  const token = integration.access_token
  const igUserId = integration.instagram_user_id
  const media = await graphGet(`/${igUserId}/media`, token, {
    fields: 'id,media_type,caption,permalink,timestamp,like_count,comments_count',
    limit: '50',
  })
  const rows = []
  for (const item of media.data || []) {
    const insights = await collectInsightMetrics(item.id, token, ['reach', 'views', 'shares', 'saved'])
    rows.push({
      client_id: integration.client_id,
      instagram_integration_id: integration.id,
      media_id: item.id,
      media_type: item.media_type || null,
      caption: item.caption || '',
      permalink: item.permalink || null,
      timestamp: item.timestamp || null,
      reach: latestMetric(insights.reach),
      views: latestMetric(insights.views),
      likes: Number(item.like_count || 0),
      comments: Number(item.comments_count || 0),
      shares: latestMetric(insights.shares),
      saves: latestMetric(insights.saved),
      raw_data: { media: item, insights },
    })
  }
  if (rows.length) await sbUpsert('instagram_media_metrics', rows, 'instagram_integration_id,media_id')
  await sbPatch('instagram_integrations', `id=eq.${integration.id}`, {
    last_sync_at: new Date().toISOString(),
    status: 'active',
  })
  return rows
}

async function collectInsightMetrics(objectId, token, metrics, extraParams = {}) {
  const out = {}
  for (const metric of metrics) {
    try {
      const data = await graphGet(`/${objectId}/insights`, token, { ...extraParams, metric })
      out[metric] = data.data?.[0]?.values || []
    } catch (err) {
      out[metric] = []
    }
  }
  return out
}

function latestMetric(points = []) {
  const point = points[points.length - 1]
  return point ? numberValue(point.value) : 0
}

function numberValue(value) {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    return Number(value.value ?? value.total_value?.value ?? 0)
  }
  return Number(value || 0)
}

export async function sbGet(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders() })
  const data = await res.json().catch(() => [])
  if (!res.ok) throw new Error(data.message || `Supabase GET ${table} HTTP ${res.status}`)
  return data
}

export async function sbInsert(table, body, prefer = 'return=representation') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: prefer },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || `Supabase INSERT ${table} HTTP ${res.status}`)
  return data
}

export async function sbPatch(table, filter, body, prefer = 'return=representation') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: prefer },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || `Supabase PATCH ${table} HTTP ${res.status}`)
  return data
}

export async function sbUpsert(table, body, onConflict) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || `Supabase UPSERT ${table} HTTP ${res.status}`)
  return data
}

export function sbHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  }
}
