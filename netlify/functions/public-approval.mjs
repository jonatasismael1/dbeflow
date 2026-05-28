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
      return json({ approval: await getApproval(token) })
    }

    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

    const body = await req.json().catch(() => ({}))
    const token = body.token
    const action = body.action
    if (!token) return json({ error: 'Token de aprovação não informado.' }, 400)
    if (!['approve', 'request_changes'].includes(action)) return json({ error: 'Ação inválida.' }, 400)

    const approval = await getApproval(token, false)
    if (approval.status !== 'pending') return json({ approval: await enrichApproval(approval) })

    const status = action === 'approve' ? 'approved' : 'requested_changes'
    const comment = String(body.comment || '').trim()
    const next = {
      ...approval,
      status,
      updated_at: new Date().toISOString(),
      comments: [
        ...(approval.comments || []),
        ...(comment ? [{
          id: crypto.randomUUID(),
          author_name: String(body.author_name || '').trim() || 'Cliente',
          content: comment,
          section: 'geral',
          created_at: new Date().toISOString(),
        }] : []),
      ],
    }

    await updateJsonRow('dbe_approvals', approval.id, next)
    await updateScriptStatus(approval.script_id, status === 'approved' ? 'Aprovado' : 'Aprovando')
    return json({ approval: await enrichApproval(next) })
  } catch (err) {
    return json({ error: err.message || 'Erro na aprovação.' }, err.status || 500)
  }
}

async function getApproval(token, enriched = true) {
  const rows = await restGet(`dbe_approvals?select=id,data&${encodeURIComponent('data->>token')}=eq.${encodeURIComponent(token)}&limit=1`)
  const row = rows?.[0]
  if (!row) throw Object.assign(new Error('Link de aprovação inválido.'), { status: 404 })
  const approval = { id: row.id, ...(row.data || {}) }
  if (approval.expires_at && new Date(approval.expires_at) < new Date() && approval.status === 'pending') {
    throw Object.assign(new Error('Este link de aprovação expirou.'), { status: 410 })
  }
  return enriched ? enrichApproval(approval) : approval
}

async function enrichApproval(approval) {
  return { ...approval, script: await getScript(approval.script_id) }
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
