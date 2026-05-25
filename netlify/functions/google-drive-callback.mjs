// Recebe o callback OAuth do Google após o usuário autorizar o acesso.
// Valida o state (anti-CSRF), troca o code por tokens, busca o e-mail
// da conta Google e salva tudo no banco.
import {
  validateState,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  ROOT_FOLDER_ID,
  SB_URL,
  sbHeaders,
} from './lib/google-drive.mjs'

const APP_URL = process.env.APP_URL || 'https://dbeflow.netlify.app'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'

export default async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const redirect = (msg, ok = false) =>
    Response.redirect(
      `${APP_URL}?tab=integracoes&drive_status=${ok ? 'ok' : 'erro'}&msg=${encodeURIComponent(msg)}`,
      302,
    )

  if (error) return redirect(error)
  if (!validateState(state)) return redirect('state_invalido — possível ataque CSRF')
  if (!code) return redirect('authorization_code ausente')
  if (!CLIENT_ID || !CLIENT_SECRET) return redirect('Credenciais Google não configuradas no servidor')

  try {
    // Troca o authorization code por access_token + refresh_token
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokens.error_description || tokens.error || 'Erro ao obter tokens')
    if (!tokens.refresh_token) throw new Error('Google não retornou refresh_token — revogue o acesso em myaccount.google.com e tente novamente')

    // Busca o e-mail da conta autorizada
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json().catch(() => ({}))
    const email = profile.email || ''

    const folderRes = await fetch(
      `${DRIVE_API}/files/${ROOT_FOLDER_ID}?fields=id,name,capabilities(canAddChildren),owners(emailAddress)&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    )
    const folder = await folderRes.json().catch(() => ({}))
    if (!folderRes.ok) {
      throw new Error(`A conta ${email || 'selecionada'} não acessa a pasta raiz do Drive. Compartilhe a pasta com essa conta e tente novamente.`)
    }
    if (folder.capabilities && folder.capabilities.canAddChildren === false) {
      throw new Error(`A conta ${email} acessa a pasta "${folder.name}", mas não pode criar arquivos nela. Compartilhe como Editor.`)
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Upsert: usa singleton_key='default' para sempre ter no máximo 1 linha
    await fetch(
      `${SB_URL}/rest/v1/google_drive_integrations?on_conflict=singleton_key`,
      {
        method: 'POST',
        headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          singleton_key: 'default',
          google_account_email: email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
          expires_at: expiresAt,
          root_folder_id: ROOT_FOLDER_ID,
          status: 'active',
          connected_at: new Date().toISOString(),
        }),
      },
    )

    return redirect(`Conectado como ${email}`, true)
  } catch (err) {
    console.error('[drive-callback]', err)
    return redirect(err.message)
  }
}
