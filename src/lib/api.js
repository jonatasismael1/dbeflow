// Chamadas do frontend para as funções serverless (Netlify Functions).
// As chaves secretas (Evolution, Meta, OpenRouter) ficam SÓ no servidor.
// Em produção (Netlify) e com `netlify dev` localmente, o caminho abaixo funciona.

const BASE = '/.netlify/functions'

async function call(fn, body) {
  try {
    const res = await fetch(`${BASE}/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` }
    return { ok: true, ...json }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// --- WhatsApp (Evolution) ---
export const whatsapp = {
  send: (phone, message) => call('whatsapp-send', { phone, message }),
  sendDocument: (phone, mediaBase64, fileName, caption) =>
    call('whatsapp-send', { phone, mediaBase64, fileName, caption }),
  status: () => call('whatsapp-connect', { action: 'status' }),
  connect: () => call('whatsapp-connect', { action: 'connect' }),
}

// --- Contratos ---
export const contract = {
  generate: (data) => call('contract-generate', data),
}

// --- Meta / Instagram ---
export const meta = {
  insights: (igUserId) => call('meta-insights', { igUserId }),
  publish: (igUserId, imageUrl, caption) => call('meta-publish', { igUserId, imageUrl, caption }),
}

// --- IA Deby (OpenRouter) ---
export const ai = {
  ask: (feature, prompt, context) => call('ai-deby', { feature, prompt, context }),
}
