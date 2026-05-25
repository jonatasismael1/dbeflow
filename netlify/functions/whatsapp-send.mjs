// Envia mensagem ou documento via Evolution API e registra no Supabase.
// body: { phone, message }                         → texto simples
// body: { phone, mediaBase64, fileName, caption }  → documento (DOCX, PDF, etc.)
const EVO_URL = process.env.EVOLUTION_API_URL
const KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'dbe-flow'
const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const evoHeaders = { 'Content-Type': 'application/json', apikey: KEY }

export default async (req) => {
  if (!EVO_URL || !KEY) return json({ error: 'Evolution não configurada (.env)' }, 500)
  const body = await req.json().catch(() => ({}))
  const { phone, message, mediaBase64, fileName, caption } = body
  if (!phone) return json({ error: 'Informe o telefone' }, 400)

  const number = String(phone).replace(/\D/g, '')
  if (number.length < 10) return json({ error: 'Telefone inválido' }, 400)
  const remoteJid = `${number}@s.whatsapp.net`
  const ts = new Date().toISOString()

  try {
    let res, sentContent, msgType

    if (mediaBase64 && fileName) {
      const mime = fileName.endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'

      res = await fetch(`${EVO_URL}/message/sendMedia/${INSTANCE}`, {
        method: 'POST',
        headers: evoHeaders,
        body: JSON.stringify({
          number,
          mediatype: 'document',
          media: mediaBase64,
          fileName,
          mimetype: mime,
          caption: caption || '',
        }),
      })
      sentContent = caption || `📄 ${fileName}`
      msgType = 'document'
    } else {
      if (!message) return json({ error: 'Informe message ou mediaBase64+fileName' }, 400)
      res = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
        method: 'POST',
        headers: evoHeaders,
        body: JSON.stringify({ number, text: message }),
      })
      sentContent = message
      msgType = 'text'
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) return json({ ok: false, error: data?.message || `HTTP ${res.status}`, data }, 502)

    // Registra mensagem enviada no Supabase (não bloqueia a resposta)
    if (SB_URL && SB_KEY) {
      const waId = data?.key?.id || `sent-${Date.now()}`
      const sbHeaders = { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
      const upsertPrefer = 'resolution=merge-duplicates,return=minimal'

      Promise.all([
        fetch(`${SB_URL}/rest/v1/wa_messages?on_conflict=wa_message_id`, {
          method: 'POST',
          headers: { ...sbHeaders, Prefer: upsertPrefer },
          body: JSON.stringify({ wa_message_id: waId, remote_jid: remoteJid, from_me: true, content: sentContent, message_type: msgType, ts, raw: data }),
        }),
        fetch(`${SB_URL}/rest/v1/wa_conversations?on_conflict=remote_jid`, {
          method: 'POST',
          headers: { ...sbHeaders, Prefer: upsertPrefer },
          body: JSON.stringify({ remote_jid: remoteJid, last_message: sentContent, last_at: ts }),
        }),
      ]).catch((e) => console.warn('[send] save', e.message))
    }

    return json({ ok: true, id: data?.key?.id || null, data })
  } catch (err) {
    return json({ error: err.message }, 502)
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
