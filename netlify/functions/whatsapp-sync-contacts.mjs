// Importa contatos existentes da instância Evolution para o inbox do DBE Flow.
const EVO_URL = process.env.EVOLUTION_API_URL
const EVO_KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'dbe-flow'
const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const evoHeaders = { 'Content-Type': 'application/json', apikey: EVO_KEY }
const sbHeaders = {
  'Content-Type': 'application/json',
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
}

async function upsert(table, row, onConflict) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${table}: ${res.status} ${text}`)
  }
}

function normalizeContact(contact) {
  const remoteJid = contact?.remoteJid || contact?.id || contact?.jid
  if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@lid')) return null
  const phone = String(remoteJid).split('@')[0]
  if (!phone || phone === '0') return null
  const name = contact?.pushName || contact?.name || contact?.verifiedName || phone
  return {
    remote_jid: remoteJid,
    phone,
    name,
    push_name: contact?.pushName || name,
    profile_pic: contact?.profilePicUrl || contact?.profilePictureUrl || null,
  }
}

export default async () => {
  if (!EVO_URL || !EVO_KEY) return json({ error: 'Evolution não configurada' }, 500)
  if (!SB_URL || !SB_KEY) return json({ error: 'Supabase não configurado' }, 500)

  try {
    const res = await fetch(`${EVO_URL}/chat/findContacts/${INSTANCE}`, {
      method: 'POST',
      headers: evoHeaders,
      body: JSON.stringify({}),
    })
    const data = await res.json().catch(() => [])
    if (!res.ok) return json({ error: data?.message || `Evolution HTTP ${res.status}`, data }, 502)

    const contacts = (Array.isArray(data) ? data : data?.contacts || [])
      .map(normalizeContact)
      .filter(Boolean)

    for (const contact of contacts) {
      await upsert('wa_contacts', contact, 'remote_jid')
      await upsert('wa_conversations', {
        remote_jid: contact.remote_jid,
        name: contact.name,
        profile_pic: contact.profile_pic,
        last_message: 'Contato sincronizado',
        last_at: new Date().toISOString(),
      }, 'remote_jid')
    }

    return json({ ok: true, imported: contacts.length })
  } catch (err) {
    return json({ error: err.message }, 502)
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

