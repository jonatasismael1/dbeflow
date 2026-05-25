// Publica uma imagem com legenda no Instagram (Graph API, 2 passos:
// cria o container de mídia e depois publica). imageUrl precisa ser uma URL
// pública (https). Para Reels/vídeo o fluxo é parecido (media_type=REELS).
const TOKEN = process.env.META_ACCESS_TOKEN
const V = process.env.META_GRAPH_API_VERSION || 'v25.0'
const G = `https://graph.facebook.com/${V}`

export default async (req) => {
  if (!TOKEN) return json({ error: 'Meta não configurada (.env)' }, 500)
  const { igUserId, imageUrl, caption } = await req.json().catch(() => ({}))
  if (!igUserId || !imageUrl) return json({ error: 'Informe igUserId e imageUrl' }, 400)

  try {
    // 1) cria o container
    const createRes = await fetch(`${G}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption: caption || '', access_token: TOKEN }),
    })
    const created = await createRes.json()
    if (created.error) return json({ error: created.error.message }, 502)

    // 2) publica o container
    const pubRes = await fetch(`${G}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: created.id, access_token: TOKEN }),
    })
    const published = await pubRes.json()
    if (published.error) return json({ error: published.error.message }, 502)

    return json({ ok: true, postId: published.id })
  } catch (err) {
    return json({ error: err.message }, 502)
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
