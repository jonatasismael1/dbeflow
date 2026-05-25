// Recebe os eventos da Evolution API (mensagens recebidas) e grava no Supabase.
// Suporta texto, fotos, vídeos, áudios e documentos — faz download e sobe no Storage.
// Configure o webhook da instância para: https://SEU-SITE.netlify.app/.netlify/functions/whatsapp-webhook
const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EVO_URL = process.env.EVOLUTION_API_URL
const EVO_KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'dbe-flow'

const sbHeaders = {
  'Content-Type': 'application/json',
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
}

async function upsert(table, row, onConflict) {
  const url = `${SB_URL}/rest/v1/${table}?on_conflict=${onConflict}`
  await fetch(url, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  }).catch((e) => console.warn('[webhook] upsert', table, e.message))
}

// Detecta o tipo de mídia e baixa da Evolution, faz upload pro Supabase Storage.
// Retorna { mediaUrl, mediaMime } ou null se não for mídia.
async function handleMedia(msg, waId) {
  const m = msg?.message
  if (!m) return null

  const mediaMap = {
    imageMessage: { mime: 'image/jpeg', ext: 'jpg', type: 'image' },
    videoMessage: { mime: 'video/mp4', ext: 'mp4', type: 'video' },
    audioMessage: { mime: 'audio/ogg; codecs=opus', ext: 'ogg', type: 'audio' },
    documentMessage: { mime: m.documentMessage?.mimetype || 'application/octet-stream', ext: 'bin', type: 'document' },
    stickerMessage: { mime: 'image/webp', ext: 'webp', type: 'sticker' },
    ptvMessage: { mime: 'video/mp4', ext: 'mp4', type: 'video' },
  }

  const [msgType, meta] = Object.entries(mediaMap).find(([k]) => m[k]) || []
  if (!msgType) return null

  if (!EVO_URL || !EVO_KEY) return { mediaUrl: null, mediaMime: meta.mime, msgType: meta.type }

  try {
    // Pede o base64 da mídia para a Evolution
    const res = await fetch(`${EVO_URL}/chat/getBase64FromMediaMessage/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ message: { key: msg.key, message: m }, convertToMp4: false }),
    })
    if (!res.ok) return { mediaUrl: null, mediaMime: meta.mime, msgType: meta.type }

    const { base64, mimetype } = await res.json().catch(() => ({}))
    if (!base64) return { mediaUrl: null, mediaMime: meta.mime, msgType: meta.type }

    // Sobe no Supabase Storage (bucket wa-media)
    const buf = Buffer.from(base64, 'base64')
    const fileName = `${waId}.${meta.ext}`
    const finalMime = mimetype || meta.mime

    const upload = await fetch(`${SB_URL}/storage/v1/object/wa-media/${fileName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': finalMime,
        'x-upsert': 'true',
      },
      body: buf,
    }).catch(() => null)

    if (!upload?.ok) return { mediaUrl: null, mediaMime: finalMime, msgType: meta.type }

    const mediaUrl = `${SB_URL}/storage/v1/object/public/wa-media/${fileName}`
    return { mediaUrl, mediaMime: finalMime, msgType: meta.type }
  } catch (e) {
    console.warn('[webhook] media download', e.message)
    return { mediaUrl: null, mediaMime: meta.mime, msgType: meta.type }
  }
}

function extractText(message) {
  if (!message) return ''
  return message.conversation
    || message.extendedTextMessage?.text
    || message.imageMessage?.caption
    || message.videoMessage?.caption
    || message.documentMessage?.caption
    || message.audioMessage?.caption
    || ''
}

export default async (req) => {
  if (!SB_URL || !SB_KEY) return json({ error: 'Supabase não configurado' }, 500)
  const payload = await req.json().catch(() => ({}))

  const event = payload.event || payload.type
  const data = payload.data || payload

  if (event && event.toLowerCase().includes('messages')) {
    const msg = Array.isArray(data) ? data[0] : data
    const remoteJid = msg?.key?.remoteJid || msg?.remoteJid
    if (remoteJid && !remoteJid.includes('@g.us')) {
      const fromMe = Boolean(msg?.key?.fromMe)
      const waId = msg?.key?.id
      const text = extractText(msg?.message)
      const pushName = msg?.pushName || null
      const phone = remoteJid.split('@')[0]
      const ts = msg?.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString()

      // Download e armazenamento de mídia (paralelo, não bloqueia o 200)
      const mediaResult = await handleMedia(msg, waId)

      const displayContent = text || (mediaResult ? `[${mediaResult.msgType}]` : '')

      await upsert('wa_contacts', { remote_jid: remoteJid, phone, push_name: pushName, name: pushName }, 'remote_jid')
      await upsert('wa_conversations', { remote_jid: remoteJid, name: pushName, last_message: displayContent, last_at: ts }, 'remote_jid')
      await upsert('wa_messages', {
        wa_message_id: waId,
        remote_jid: remoteJid,
        from_me: fromMe,
        content: displayContent,
        message_type: mediaResult?.msgType || 'text',
        media_url: mediaResult?.mediaUrl || null,
        media_mime: mediaResult?.mediaMime || null,
        ts,
        raw: msg,
      }, 'wa_message_id')
    }
  }

  return json({ ok: true })
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
