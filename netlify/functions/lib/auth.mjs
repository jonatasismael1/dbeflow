const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const jsonHeaders = { 'Content-Type': 'application/json' }

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message)
    this.status = status
  }
}

function bearerToken(req) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

export async function getAuthenticatedUser(req) {
  if (!SB_URL || !SB_KEY) throw new AuthError('Supabase nao configurado no servidor', 500)
  const token = bearerToken(req)
  if (!token) throw new AuthError('Sessao obrigatoria', 401)

  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: {
      ...jsonHeaders,
      apikey: SB_KEY,
      Authorization: `Bearer ${token}`,
    },
  })
  const user = await res.json().catch(() => ({}))
  if (!res.ok || !user?.id) throw new AuthError('Sessao invalida ou expirada', 401)
  return user
}

export async function requireAuthenticatedUser(req) {
  return getAuthenticatedUser(req)
}

export async function requireAdminUser(req) {
  const user = await getAuthenticatedUser(req)
  const res = await fetch(
    `${SB_URL}/rest/v1/workspace_members?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=role&limit=1`,
    {
      headers: {
        ...jsonHeaders,
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
      },
    },
  )
  const rows = await res.json().catch(() => [])
  if (!res.ok) throw new AuthError('Nao foi possivel validar permissao', 500)
  if (rows?.[0]?.role !== 'admin') throw new AuthError('Permissao de administrador obrigatoria', 403)
  return user
}

export const authJson = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: jsonHeaders })
