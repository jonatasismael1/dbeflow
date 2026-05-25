// Inicia upload resumable para o arquivo final na pasta "03 - Final".
// Igual ao raw, mas para category=final e atualiza status do projeto.
// Body: { videoProjectId, finalFolderId, fileName, mimeType }
// Retorna: { ok, upload_uri }
import { initResumableUpload, SB_URL, sbHeaders, jsonRes } from './lib/google-drive.mjs'

export default async (req) => {
  const { videoProjectId, finalFolderId, fileName, mimeType } = await req.json().catch(() => ({}))
  if (!videoProjectId || !finalFolderId || !fileName) {
    return jsonRes({ error: 'videoProjectId, finalFolderId e fileName são obrigatórios' }, 400)
  }

  try {
    const projRes = await fetch(
      `${SB_URL}/rest/v1/video_projects?id=eq.${videoProjectId}&select=id,final_folder_id`,
      { headers: sbHeaders },
    )
    const projects = await projRes.json().catch(() => [])
    if (!projects[0]) return jsonRes({ error: 'Projeto não encontrado' }, 404)

    const folderId = finalFolderId || projects[0].final_folder_id
    const safeMime = mimeType || 'video/mp4'

    const uploadUri = await initResumableUpload(fileName, safeMime, folderId)

    return jsonRes({ ok: true, upload_uri: uploadUri, folder_id: folderId })
  } catch (err) {
    console.error('[drive-upload-final-file]', err)
    return jsonRes({ error: err.message }, 500)
  }
}
