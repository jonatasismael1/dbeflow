// Starts a resumable upload for raw files in a video script folder.
import { initResumableUpload, SB_URL, sbHeaders, jsonRes } from './lib/google-drive.mjs'

export default async (req) => {
  const { scriptId, folderId, fileName, mimeType } = await req.json().catch(() => ({}))
  if (!scriptId || !folderId || !fileName) return jsonRes({ error: 'scriptId, folderId e fileName sao obrigatorios' }, 400)

  try {
    const scriptRes = await fetch(`${SB_URL}/rest/v1/scripts?id=eq.${scriptId}&select=id,data`, { headers: sbHeaders })
    const scripts = await scriptRes.json().catch(() => [])
    const script = scripts[0]
    if (!script) return jsonRes({ error: 'Roteiro nao encontrado' }, 404)

    const allowedFolder = script.data?.drive_folder_id
    if (allowedFolder && allowedFolder !== folderId) return jsonRes({ error: 'Pasta nao corresponde ao roteiro' }, 403)

    const uploadUri = await initResumableUpload(fileName, mimeType || 'application/octet-stream', folderId)
    return jsonRes({ ok: true, upload_uri: uploadUri, folder_id: folderId })
  } catch (err) {
    console.error('[drive-upload-content-file]', err)
    return jsonRes({ error: err.message }, 500)
  }
}
