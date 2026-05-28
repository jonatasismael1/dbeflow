const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const headers = {
  'Content-Type': 'application/json',
  apikey: SB_KEY || '',
  Authorization: `Bearer ${SB_KEY || ''}`,
}

export default async (req) => {
  try {
    if (!SB_URL || !SB_KEY) return json({ error: 'Supabase não configurado no servidor.' }, 500)
    const url = new URL(req.url)

    if (req.method === 'GET') {
      const token = url.searchParams.get('token')
      if (!token) return json({ error: 'Token de aprovação não informado.' }, 400)
      return json({ batch: await getBatch(token) })
    }

    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

    const body = await req.json().catch(() => ({}))
    const token = body.token
    const action = body.action
    if (!token) return json({ error: 'Token de aprovação não informado.' }, 400)
    if (!['approve', 'request_changes'].includes(action)) return json({ error: 'Ação inválida.' }, 400)

    const batch = await getBatch(token, false)
    const status = action === 'approve' ? 'approved' : 'requested_changes'
    const targetScriptId = body.script_id || null
    const comment = String(body.comment || '').trim()
    const affectedIds = []
    const now = new Date().toISOString()

    const items = (batch.items || []).map((item) => {
      if (targetScriptId && item.script_id !== targetScriptId) return item
      affectedIds.push(item.script_id)
      return {
        ...item,
        status,
        reviewed_at: now,
        comments: [
          ...(item.comments || []),
          ...(comment ? [{
            id: crypto.randomUUID(),
            author_name: String(body.author_name || '').trim() || 'Cliente',
            content: comment,
            section: 'geral',
            created_at: now,
          }] : []),
        ],
      }
    })

    const batchStatus = items.every((item) => item.status === 'approved')
      ? 'approved'
      : items.some((item) => item.status === 'requested_changes')
        ? 'requested_changes'
        : 'pending'

    const next = { ...batch, items, status: batchStatus, updated_at: now }
    await updateJsonRow('dbe_approval_batches', batch.id, next)
    await Promise.all(affectedIds.map((id) => updateScriptStatus(id, status === 'approved' ? 'Aprovado' : 'Aprovando')))
    return json({ batch: await enrichBatch(next) })
  } catch (err) {
    return json({ error: err.message || 'Erro no lote de aprovação.' }, err.status || 500)
  }
}

async function getBatch(token, enriched = true) {
  const rows = await restGet(`dbe_approval_batches?select=id,data&${encodeURIComponent('data->>token')}=eq.${encodeURIComponent(token)}&limit=1`)
  const row = rows?.[0]
  if (!row) throw Object.assign(new Error('Link de aprovação inválido.'), { status: 404 })
  const batch = { id: row.id, ...(row.data || {}) }
  if (batch.expires_at && new Date(batch.expires_at) < new Date() && batch.status === 'pending') {
    throw Object.assign(new Error('Este link de aprovação expirou.'), { status: 410 })
  }
  return enriched ? enrichBatch(batch) : batch
}

async function enrichBatch(batch) {
  const items = await Promise.all((batch.items || []).map(async (item) => ({
    ...item,
    script: await getScript(item.script_id),
  })))
  return { ...batch, items }
}

async function getScript(id) {
  if (!id) return null
  const rows = await restGet(`dbe_scripts?select=id,data&id=eq.${encodeURIComponent(id)}&limit=1`)
  const row = rows?.[0]
  return row ? { id: row.id, ...(row.data || {}) } : null
}

async function updateScriptStatus(id, status) {
  const script = await getScript(id)
  if (!script) return
  await updateJsonRow('dbe_scripts', id, { ...script, status, updated_at: new Date().toISOString() })
}

async function restGet(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || `Supabase HTTP ${res.status}`)
  return data
}

async function updateJsonRow(table, id, data) {
  const { id: _id, ...payload } = data
  const res = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ data: payload }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Supabase HTTP ${res.status}`)
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}
