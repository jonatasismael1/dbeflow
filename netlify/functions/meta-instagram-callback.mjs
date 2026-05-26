import {
  APP_URL,
  assertClientAccess,
  assertServerConfig,
  exchangeCode,
  getInstagramAccounts,
  parseState,
  sbInsert,
  sbPatch,
} from './lib/meta-instagram.mjs'

export default async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error_description') || url.searchParams.get('error')

  try {
    assertServerConfig()
    if (error) throw new Error(error)
    if (!code) throw new Error('Code OAuth ausente.')
    const payload = parseState(state)
    const user = {
      id: payload.user_id,
      email: payload.user_email,
      role: payload.user_role,
    }
    await assertClientAccess(payload.client_id, user)

    const token = await exchangeCode(code)
    const accounts = await getInstagramAccounts(token.access_token)
    const selected = accounts[0]
    if (!selected?.instagram_business_account?.id) {
      throw new Error('Nenhuma conta profissional do Instagram vinculada a uma Pagina foi encontrada.')
    }

    const ig = selected.instagram_business_account
    const now = new Date().toISOString()
    const expiresAt = token.expires_in
      ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
      : null

    await sbPatch(
      'instagram_integrations',
      `client_id=eq.${encodeURIComponent(payload.client_id)}&is_active=eq.true&provider=eq.meta`,
      { is_active: false, status: 'replaced', disconnected_at: now },
      'return=minimal',
    )

    await sbInsert('instagram_integrations', {
      client_id: payload.client_id,
      user_id: payload.user_id || payload.user_email,
      provider: 'meta',
      instagram_user_id: ig.id,
      instagram_username: ig.username || null,
      access_token: selected.access_token || token.access_token,
      token_expires_at: expiresAt,
      status: 'active',
      is_active: true,
      connected_at: now,
    })

    return redirect(`/?tab=instagram&instagram_client_id=${encodeURIComponent(payload.client_id)}&instagram_connected=1`)
  } catch (err) {
    return redirect(`/?tab=instagram&instagram_error=${encodeURIComponent(err.message)}`)
  }
}

function redirect(path) {
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP_URL}${path}` },
  })
}
