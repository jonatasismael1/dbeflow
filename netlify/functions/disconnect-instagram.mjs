import {
  assertClientAccess,
  assertServerConfig,
  dashboardPayload,
  json,
  normalizeUser,
  sbPatch,
} from './lib/meta-instagram.mjs'
import { requireAdminUser } from './lib/auth.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido' }, 405)
  try {
    assertServerConfig()
    await requireAdminUser(req)
    const body = await req.json().catch(() => ({}))
    const clientId = body.clientId || body.client_id
    const user = normalizeUser(body)
    await assertClientAccess(clientId, user)

    await sbPatch(
      'instagram_integrations',
      `client_id=eq.${encodeURIComponent(clientId)}&is_active=eq.true&provider=eq.meta`,
      { is_active: false, status: 'disconnected', disconnected_at: new Date().toISOString() },
      'return=minimal',
    )
    return json({ ok: true, ...(await dashboardPayload(clientId)) })
  } catch (err) {
    return json({ error: err.message }, err.status || 500)
  }
}
