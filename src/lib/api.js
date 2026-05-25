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
  setWebhook: (webhookUrl) => call('whatsapp-connect', { action: 'set_webhook', webhookUrl }),
  syncContacts: () => call('whatsapp-sync-contacts'),
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

// --- Google Drive ---
export const drive = {
  // Redireciona o browser para a tela de autorização OAuth do Google
  startAuth: () => { window.location.href = '/.netlify/functions/google-drive-auth' },

  createClientFolder: (clientId, clientName) =>
    call('drive-create-client-folder', { clientId, clientName }),

  createVideoProject: (clientId, clientName, title, recordingDate, notes) =>
    call('drive-create-video-project', { clientId, clientName, title, recordingDate, notes }),

  // Retorna um upload_uri para o frontend fazer PUT direto no Drive (sem expor o access_token)
  getRawUploadUrl: (videoProjectId, rawFolderId, fileName, mimeType) =>
    call('drive-upload-raw-files', { videoProjectId, rawFolderId, fileName, mimeType }),

  getFinalUploadUrl: (videoProjectId, finalFolderId, fileName, mimeType) =>
    call('drive-upload-final-file', { videoProjectId, finalFolderId, fileName, mimeType }),

  saveFile: (meta) => call('drive-save-file', meta),

  updateProjectStatus: (videoProjectId, status) =>
    call('drive-save-file', { videoProjectId, status, _statusOnly: true }),
}
