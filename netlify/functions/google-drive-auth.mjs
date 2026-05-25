// Inicia o fluxo OAuth 2.0 do Google Drive.
// GET → redireciona o usuário para a tela de autorização do Google.
// Usa access_type=offline para obter refresh_token e prompt=consent para garantir
// que o refresh_token seja sempre retornado (mesmo em reconexões).
import { generateState, CLIENT_ID, REDIRECT_URI } from './lib/google-drive.mjs'

// A pasta raiz já existe e pode ser de outra conta da equipe.
// O escopo drive.file não acessa bem pastas compartilhadas pré-existentes.
const SCOPES = 'https://www.googleapis.com/auth/drive'

export default async (req) => {
  if (!CLIENT_ID) {
    return new Response('GOOGLE_CLIENT_ID não configurado nas variáveis de ambiente.', {
      status: 500,
    })
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    return new Response('GOOGLE_CLIENT_SECRET não configurado nas variáveis de ambiente.', {
      status: 500,
    })
  }

  const state = generateState()
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // garante refresh_token mesmo em reconexões
    state,
  })

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    302,
  )
}
