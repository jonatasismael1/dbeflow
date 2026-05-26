import {
  getValidToken,
  createDriveFolder,
  findDriveFolderByName,
  driveReq,
  SB_URL,
  sbHeaders,
  driveUrl,
  fileUrl,
  jsonRes,
} from './lib/google-drive.mjs'

const EDITED_VIDEO_FOLDER = 'Vídeo editado'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

async function getScript(scriptId) {
  const res = await fetch(`${SB_URL}/rest/v1/dbe_scripts?id=eq.${scriptId}&select=id,data`, { headers: sbHeaders })
  const rows = await res.json().catch(() => [])
  return rows[0] || null
}

async function patchScript(scriptId, data) {
  await fetch(`${SB_URL}/rest/v1/dbe_scripts?id=eq.${scriptId}`, {
    method: 'PATCH',
    headers: sbHeaders,
    body: JSON.stringify({ data }),
  })
}

export default async (req) => {
  const { scriptId } = await req.json().catch(() => ({}))
  if (!scriptId) return jsonRes({ error: 'scriptId e obrigatorio' }, 400)

  try {
    const token = await getValidToken()
    const script = await getScript(scriptId)
    if (!script) return jsonRes({ error: 'Roteiro nao encontrado' }, 404)

    const currentData = script.data || {}
    const contentFolderId = currentData.drive_folder_id
    if (!contentFolderId) return jsonRes({ error: 'Roteiro ainda nao tem pasta no Drive' }, 400)

    let editedFolder = currentData.edited_folder_id
      ? { id: currentData.edited_folder_id, name: EDITED_VIDEO_FOLDER, webViewLink: currentData.edited_folder_url }
      : await findDriveFolderByName(EDITED_VIDEO_FOLDER, contentFolderId, token)

    if (!editedFolder) editedFolder = await createDriveFolder(EDITED_VIDEO_FOLDER, contentFolderId, token)

    if (!currentData.edited_folder_id || currentData.edited_folder_id !== editedFolder.id) {
      await patchScript(scriptId, {
        ...currentData,
        edited_folder_id: editedFolder.id,
        edited_folder_url: editedFolder.webViewLink || driveUrl(editedFolder.id),
        updatedAt: new Date().toISOString(),
      })
    }

    const params = new URLSearchParams({
      q: `'${editedFolder.id}' in parents and mimeType != '${FOLDER_MIME}' and trashed = false`,
      fields: 'files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,modifiedTime,size,videoMediaMetadata)',
      orderBy: 'modifiedTime desc,name',
      pageSize: '100',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })
    const filesRes = await driveReq(`/files?${params}`, {}, token)
    if (!filesRes.ok) return jsonRes({ error: filesRes.data?.error?.message || 'Nao foi possivel listar videos editados' }, filesRes.status)

    const files = (filesRes.data.files || []).map((item) => ({
      ...item,
      url: item.webViewLink || fileUrl(item.id),
      previewUrl: `https://drive.google.com/file/d/${item.id}/preview`,
      isVideo: String(item.mimeType || '').startsWith('video/'),
    }))

    return jsonRes({
      ok: true,
      folderId: editedFolder.id,
      folderUrl: editedFolder.webViewLink || driveUrl(editedFolder.id),
      files,
    })
  } catch (err) {
    console.error('[drive-list-edited-files]', err)
    return jsonRes({ error: err.message }, 500)
  }
}
