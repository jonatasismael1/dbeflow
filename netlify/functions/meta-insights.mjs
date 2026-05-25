// Busca dados/insights de uma conta do Instagram via Graph API.
// Sem igUserId, devolve as contas/páginas disponíveis no token.
const TOKEN = process.env.META_ACCESS_TOKEN
const V = process.env.META_GRAPH_API_VERSION || 'v25.0'
const G = `https://graph.facebook.com/${V}`

export default async (req) => {
  if (!TOKEN) return json({ error: 'Meta não configurada (.env)' }, 500)
  const { igUserId } = await req.json().catch(() => ({}))

  try {
    if (!igUserId) {
      // Lista páginas e a conta IG vinculada a cada uma
      const res = await fetch(`${G}/me/accounts?fields=name,id,instagram_business_account{id,username,followers_count,profile_picture_url}&access_token=${TOKEN}`)
      const data = await res.json()
      if (data.error) return json({ error: data.error.message }, 502)
      return json({ ok: true, accounts: data.data || [] })
    }

    // Métricas básicas da conta IG
    const fields = 'followers_count,media_count,username,name,profile_picture_url'
    const profileRes = await fetch(`${G}/${igUserId}?fields=${fields}&access_token=${TOKEN}`)
    const profile = await profileRes.json()
    if (profile.error) return json({ error: profile.error.message }, 502)

    const insRes = await fetch(`${G}/${igUserId}/insights?metric=reach,profile_views&period=day&access_token=${TOKEN}`)
    const insights = await insRes.json().catch(() => ({}))

    return json({ ok: true, profile, insights: insights.data || [] })
  } catch (err) {
    return json({ error: err.message }, 502)
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
