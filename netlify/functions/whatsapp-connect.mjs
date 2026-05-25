// Conecta/verifica a instância do WhatsApp na Evolution API.
// action = "status"  -> estado da conexão (open/connecting/close)
// action = "connect" -> cria a instância (se preciso) e devolve o QR code
const URL = process.env.EVOLUTION_API_URL
const KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'dbe-flow'

const headers = { 'Content-Type': 'application/json', apikey: KEY }

export default async (req) => {
  if (!URL || !KEY) return json({ error: 'Evolution não configurada (.env)' }, 500)
  const body = await req.json().catch(() => ({}))
  const { action = 'status' } = body

  try {
    if (action === 'status') {
      const res = await fetch(`${URL}/instance/connectionState/${INSTANCE}`, { headers })
      const data = await res.json().catch(() => ({}))
      return json({ ok: res.ok, state: data?.instance?.state || data?.state || 'unknown', data })
    }

    if (action === 'set_webhook') {
      // Aponta a instância para o webhook do site (chame após o deploy)
      const { webhookUrl } = body
      if (!webhookUrl) return json({ error: 'Informe webhookUrl' }, 400)
      const res = await fetch(`${URL}/webhook/set/${INSTANCE}`, {
        method: 'POST', headers,
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'CONTACTS_UPSERT'],
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      return json({ ok: res.ok, data })
    }

    if (action === 'connect') {
      // Garante que a instância existe (ignora erro se já existir)
      await fetch(`${URL}/instance/create`, {
        method: 'POST', headers,
        body: JSON.stringify({ instanceName: INSTANCE, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
      }).catch(() => {})
      // Pede o QR code para parear
      const res = await fetch(`${URL}/instance/connect/${INSTANCE}`, { headers })
      const data = await res.json().catch(() => ({}))
      const qr = data?.base64 || data?.qrcode?.base64 || null
      return json({ ok: res.ok, qr, code: data?.code || data?.pairingCode || null, data })
    }

    return json({ error: 'action inválida' }, 400)
  } catch (err) {
    return json({ error: err.message }, 502)
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
