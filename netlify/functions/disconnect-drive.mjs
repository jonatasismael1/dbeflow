import { requireAdminUser } from './lib/auth.mjs'

const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const headers = {
  'Content-Type': 'application/json',
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
}

export default async (req) => {
  try {
    const user = await requireAdminUser(req)
    if (!SB_URL || !SB_KEY) return json({ error: 'Supabase não configurado.' }, 500)

    const res = await fetch(`${SB_URL}/rest/v1/google_drive_integrations?singleton_key=eq.default`, {
      method: 'DELETE',
      headers: { ...headers, Prefer: 'return=minimal' },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return json({ error: data?.message || `Supabase HTTP ${res.status}` }, 502)
    }

    await fetch(`${SB_URL}/rest/v1/integration_logs`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        integration: 'google_drive',
        action: 'disconnect',
        status: 'success',
        message: 'Google Drive desconectado do DBE Flow',
        actor_email: user.email,
      }),
    }).catch(() => {})

    return json({ ok: true })
  } catch (err) {
    return json({ error: err.message }, err.status || 500)
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
