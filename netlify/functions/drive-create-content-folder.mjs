// Creates or links a video script folder inside the client's Drive folder.
import {
  getValidToken,
  createDriveFolder,
  findDriveFolderByName,
  ROOT_FOLDER_ID,
  SB_URL,
  sbHeaders,
  driveUrl,
  logDrive,
  jsonRes,
} from './lib/google-drive.mjs'

const EDITED_VIDEO_FOLDER = 'Vídeo editado'

async function getClient(clientId) {
  const res = await fetch(`${SB_URL}/rest/v1/clients?id=eq.${clientId}&select=id,data`, { headers: sbHeaders })
  const rows = await res.json().catch(() => [])
  return rows[0] || null
}

async function getScriptData(scriptId) {
  if (!scriptId) return {}
  const res = await fetch(`${SB_URL}/rest/v1/scripts?id=eq.${scriptId}&select=id,data`, { headers: sbHeaders })
  const rows = await res.json().catch(() => [])
  return rows[0]?.data || {}
}

async function patchClientFolder(clientId, currentData, folder) {
  await fetch(`${SB_URL}/rest/v1/clients?id=eq.${clientId}`, {
    method: 'PATCH',
    headers: sbHeaders,
    body: JSON.stringify({
      data: {
        ...currentData,
        drive_folder_id: folder.id,
        drive_folder_url: folder.webViewLink || driveUrl(folder.id),
      },
    }),
  })
}

async function patchScriptFolder(scriptId, folder, editedFolder, title) {
  if (!scriptId) return
  const res = await fetch(`${SB_URL}/rest/v1/scripts?id=eq.${scriptId}&select=id,data`, { headers: sbHeaders })
  const rows = await res.json().catch(() => [])
  const currentData = rows[0]?.data || {}
  await fetch(`${SB_URL}/rest/v1/scripts?id=eq.${scriptId}`, {
    method: 'PATCH',
    headers: sbHeaders,
    body: JSON.stringify({
      data: {
        ...currentData,
        title: currentData.title || title,
        format: currentData.format || 'Roteiro de Reels',
        drive_folder_id: folder.id,
        drive_folder_url: folder.webViewLink || driveUrl(folder.id),
        edited_folder_id: editedFolder.id,
        edited_folder_url: editedFolder.webViewLink || driveUrl(editedFolder.id),
        updatedAt: new Date().toISOString(),
      },
    }),
  })
}

export default async (req) => {
  const { scriptId, clientId, clientName, title } = await req.json().catch(() => ({}))
  if (!clientId || !clientName || !title) return jsonRes({ error: 'clientId, clientName e title sao obrigatorios' }, 400)

  try {
    const token = await getValidToken()
    const client = await getClient(clientId)
    if (!client) return jsonRes({ error: 'Cliente nao encontrado' }, 404)

    const currentData = client.data || {}
    let clientFolder = currentData.drive_folder_id
      ? { id: currentData.drive_folder_id, name: clientName, webViewLink: currentData.drive_folder_url }
      : await findDriveFolderByName(clientName, ROOT_FOLDER_ID, token)

    if (!clientFolder) {
      clientFolder = await createDriveFolder(clientName, ROOT_FOLDER_ID, token)
    }

    if (!currentData.drive_folder_id || currentData.drive_folder_id !== clientFolder.id) {
      await patchClientFolder(clientId, currentData, clientFolder)
    }

    const currentScriptData = await getScriptData(scriptId)
    let contentFolder = currentScriptData.drive_folder_id
      ? { id: currentScriptData.drive_folder_id, name: title, webViewLink: currentScriptData.drive_folder_url }
      : await findDriveFolderByName(title, clientFolder.id, token)
    let alreadyExisted = true
    if (!contentFolder) {
      contentFolder = await createDriveFolder(title, clientFolder.id, token)
      alreadyExisted = false
    }

    let editedFolder = await findDriveFolderByName(EDITED_VIDEO_FOLDER, contentFolder.id, token)
    if (!editedFolder) editedFolder = await createDriveFolder(EDITED_VIDEO_FOLDER, contentFolder.id, token)

    await patchScriptFolder(scriptId, contentFolder, editedFolder, title)

    logDrive('create_content_folder', 'script', scriptId || title, {
      client_id: clientId,
      client_name: clientName,
      title,
      folder_id: contentFolder.id,
      already_existed: alreadyExisted,
    })

    return jsonRes({
      ok: true,
      folderId: contentFolder.id,
      folderUrl: contentFolder.webViewLink || driveUrl(contentFolder.id),
      editedFolderId: editedFolder.id,
      editedFolderUrl: editedFolder.webViewLink || driveUrl(editedFolder.id),
      clientFolderId: clientFolder.id,
      clientFolderUrl: clientFolder.webViewLink || driveUrl(clientFolder.id),
      already_existed: alreadyExisted,
    })
  } catch (err) {
    console.error('[drive-create-content-folder]', err)
    return jsonRes({ error: err.message }, 500)
  }
}
