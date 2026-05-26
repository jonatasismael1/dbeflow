import {
  assertServerConfig,
  json,
  sbGet,
  syncAccountMetrics,
  syncMediaMetrics,
} from './lib/meta-instagram.mjs'

export default async () => {
  try {
    assertServerConfig()
    const integrations = await sbGet(
      'instagram_integrations',
      'is_active=eq.true&provider=eq.meta&status=eq.active&select=*',
    )
    let accountSynced = 0
    let mediaSynced = 0
    for (const integration of integrations || []) {
      try {
        accountSynced += (await syncAccountMetrics(integration)).length
        mediaSynced += (await syncMediaMetrics(integration)).length
      } catch (err) {
        console.warn('[scheduled-sync-instagram]', integration.id, err.message)
      }
    }
    return json({ ok: true, integrations: integrations?.length || 0, accountSynced, mediaSynced })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
}

export const config = {
  schedule: '@daily',
}
