import {
  assertClientAccess,
  assertServerConfig,
  dashboardPayload,
  getActiveIntegration,
  json,
  normalizeUser,
  sanitizeIntegration,
  syncMediaMetrics,
} from './lib/meta-instagram.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido' }, 405)
  try {
    assertServerConfig()
    const body = await req.json().catch(() => ({}))
    const clientId = body.clientId || body.client_id
    const user = normalizeUser(body)
    await assertClientAccess(clientId, user)

    const integration = await getActiveIntegration(clientId, true)
    if (!integration) return json({ error: 'Instagram nao conectado para este cliente.' }, 404)
    const synced = await syncMediaMetrics(integration)
    return json({
      ok: true,
      synced: synced.length,
      integration: sanitizeIntegration(integration),
      ...(await dashboardPayload(clientId)),
    })
  } catch (err) {
    return json({ error: err.message }, err.status || 500)
  }
}
