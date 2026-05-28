import { requireAuthenticatedUser } from './lib/auth.mjs'

const EVO_URL = process.env.EVOLUTION_API_URL
const KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'dbe-flow'
const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const evoHeaders = { 'Content-Type': 'application/json', apikey: KEY }
const sbHeaders = {
  'Content-Type': 'application/json',
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
}

async function logIntegration(row) {
  if (!SB_URL || !SB_KEY) return
  await fetch(`${SB_URL}/rest/v1/integration_logs`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  }).catch(() => {})
}

async function patchMessage(id, patch) {
  if (!SB_URL || !SB_KEY || !id) return
  await fetch(`${SB_URL}/rest/v1/wa_messages?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  }).catch(() => {})
}

export default async (req) => {
  if (!EVO_URL || !KEY) return json({ error: 'Evolution não configurada (.env)' }, 500)
  const body = await req.json().catch(() => ({}))
  const { action, message, text } = body
  if (!message?.wa_message_id || !message?.remote_jid) return json({ error: 'Mensagem sem ID do WhatsApp.' }, 400)

  let user = null
  try {
    user = await requireAuthenticatedUser(req)
  } catch (err) {
    return json({ error: err.message }, err.status || 401)
  }

  const now = new Date().toISOString()
  try {
    if (action === 'delete_for_everyone') {
      const res = await fetch(`${EVO_URL}/chat/deleteMessageForEveryone/${INSTANCE}`, {
        method: 'DELETE',
        headers: evoHeaders,
        body: JSON.stringify({
          id: message.wa_message_id,
          remoteJid: message.remote_jid,
          fromMe: Boolean(message.from_me),
          participant: message.participant || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || data?.error || `Evolution HTTP ${res.status}`)
      await patchMessage(message.id, {
        deleted_for_all_at: now,
        deleted_by_remote: false,
        action_status: 'deleted_for_everyone',
        action_error: null,
      })
      await logIntegration({
        integration: 'whatsapp',
        action: 'delete_message_for_everyone',
        status: 'success',
        entity_type: 'wa_messages',
        entity_id: message.id,
        message: 'Mensagem excluída para todos pelo DBE Flow',
        metadata: { wa_message_id: message.wa_message_id, remote_jid: message.remote_jid },
        actor_email: user.email,
      })
      return json({ ok: true, data })
    }

    if (action === 'edit') {
      const nextText = String(text || '').trim()
      if (!nextText) return json({ error: 'Informe o novo texto.' }, 400)
      const number = String(message.remote_jid).split('@')[0].replace(/\D/g, '')
      const res = await fetch(`${EVO_URL}/chat/updateMessage/${INSTANCE}`, {
        method: 'POST',
        headers: evoHeaders,
        body: JSON.stringify({
          number,
          text: nextText,
          key: {
            remoteJid: message.remote_jid,
            fromMe: Boolean(message.from_me),
            id: message.wa_message_id,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || data?.error || `Evolution HTTP ${res.status}`)
      const history = Array.isArray(message.edit_history) ? message.edit_history : []
      await patchMessage(message.id, {
        content: nextText,
        edited_at: now,
        edited_by_remote: false,
        edit_history: [...history, { content: message.content || '', edited_at: now, actor_email: user.email }],
        action_status: 'edited',
        action_error: null,
      })
      await logIntegration({
        integration: 'whatsapp',
        action: 'edit_message',
        status: 'success',
        entity_type: 'wa_messages',
        entity_id: message.id,
        message: 'Mensagem editada pelo DBE Flow',
        metadata: { wa_message_id: message.wa_message_id, remote_jid: message.remote_jid },
        actor_email: user.email,
      })
      return json({ ok: true, data })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (err) {
    await patchMessage(message.id, { action_status: 'error', action_error: err.message })
    await logIntegration({
      integration: 'whatsapp',
      action: action || 'message_action',
      status: 'error',
      entity_type: 'wa_messages',
      entity_id: message.id,
      message: err.message,
      metadata: { wa_message_id: message.wa_message_id, remote_jid: message.remote_jid },
      actor_email: user?.email || null,
    })
    return json({ error: err.message }, 502)
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
