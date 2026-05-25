// Inicia uma sessão de upload resumable para arquivo bruto na pasta "01 - Brutos".
// O frontend recebe o upload_uri e faz o PUT diretamente para o Google Drive —
// o access_token nunca sai do servidor.
// Body: { videoProjectId, rawFolderId, fileName, mimeType }
// Retorna: { ok, upload_uri }  — depois do PUT, chamar drive-save-file com o file_id.
import { initResumableUpload, SB_URL, sbHeaders, jsonRes } from './lib/google-drive.mjs'

export default async (req) => {
  const { videoProjectId, rawFolderId, fileName, mimeType } = await req.json().catch(() => ({}))
  if (!videoProjectId || !rawFolderId || !fileName) {
    return jsonRes({ error: 'videoProjectId, rawFolderId e fileName são obrigatórios' }, 400)
  }

  try {
    // Verifica que o projeto existe
    const projRes = await fetch(
      `${SB_URL}/rest/v1/video_projects?id=eq.${videoProjectId}&select=id,raw_folder_id`,
      { headers: sbHeaders },
    )
    const projects = await projRes.json().catch(() => [])
    if (!projects[0]) return jsonRes({ error: 'Projeto não encontrado' }, 404)

    const folderId = rawFolderId || projects[0].raw_folder_id
    const safeMime = mimeType || 'video/mp4'

    const uploadUri = await initResumableUpload(fileName, safeMime, folderId)

    return jsonRes({ ok: true, upload_uri: uploadUri, folder_id: folderId })
  } catch (err) {
    console.error('[drive-upload-raw-files]', err)
    return jsonRes({ error: err.message }, 500)
  }
}
