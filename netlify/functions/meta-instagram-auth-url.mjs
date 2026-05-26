import {
  assertClientAccess,
  assertServerConfig,
  buildState,
  json,
  metaAuthUrl,
  normalizeUser,
} from './lib/meta-instagram.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido' }, 405)
  try {
    assertServerConfig()
    const body = await req.json().catch(() => ({}))
    const clientId = body.clientId || body.client_id
    const user = normalizeUser(body)
    await assertClientAccess(clientId, user)
    const state = buildState({
      client_id: clientId,
      user_id: user.id || user.email,
      user_email: user.email,
      user_role: user.role,
    })
    return json({ ok: true, url: metaAuthUrl(state) })
  } catch (err) {
    return json({ error: err.message }, err.status || 400)
  }
}
