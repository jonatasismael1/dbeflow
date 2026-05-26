// Cria a estrutura de pastas de um projeto de vídeo no Drive e salva no banco.
// Estrutura: <clientFolder>/<YYYY-MM-DD - Título>/ → 01-Brutos / 02-Projeto / 03-Final
// Body: { clientId, clientName, title, recordingDate, notes }
import {
  getValidToken,
  createDriveFolder,
  setPublicRead,
  ROOT_FOLDER_ID,
  SB_URL,
  sbHeaders,
  driveUrl,
  logDrive,
  jsonRes,
} from './lib/google-drive.mjs'

export default async (req) => {
  const { clientId, clientName, title, recordingDate, notes } = await req.json().catch(() => ({}))
  if (!clientId || !clientName || !title) {
    return jsonRes({ error: 'clientId, clientName e title são obrigatórios' }, 400)
  }

  try {
    // Obtém (ou cria) a pasta do cliente
    const clientRes = await fetch(
      `${SB_URL}/rest/v1/dbe_clients?id=eq.${clientId}&select=id,data`,
      { headers: sbHeaders },
    )
    const clients = await clientRes.json().catch(() => [])
    let clientFolderId = clients[0]?.data?.drive_folder_id

    const token = await getValidToken()

    if (!clientFolderId) {
      const clientFolder = await createDriveFolder(clientName, ROOT_FOLDER_ID, token)
      clientFolderId = clientFolder.id
      const currentData = clients[0]?.data || {}
      await fetch(`${SB_URL}/rest/v1/dbe_clients?id=eq.${clientId}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({
          data: {
            ...currentData,
            drive_folder_id: clientFolderId,
            drive_folder_url: driveUrl(clientFolderId),
          },
        }),
      })
    }

    // Nome da pasta principal: YYYY-MM-DD - Título
    const datePrefix = recordingDate || new Date().toISOString().slice(0, 10)
    const mainFolderName = `${datePrefix} - ${title}`

    const mainFolder = await createDriveFolder(mainFolderName, clientFolderId, token)
    const rawFolder = await createDriveFolder('01 - Brutos', mainFolder.id, token)
    const projectFolder = await createDriveFolder('02 - Projeto', mainFolder.id, token)
    const finalFolder = await createDriveFolder('03 - Final', mainFolder.id, token)

    // Leitura pública para qualquer pessoa com o link (subpastas herdam)
    await setPublicRead(mainFolder.id, token)

    const folderUrl = driveUrl(mainFolder.id)

    // Salva o projeto no banco
    const projectRow = {
      client_id: clientId,
      client_name: clientName,
      title,
      recording_date: recordingDate || null,
      notes: notes || null,
      status: 'gravado',
      drive_folder_id: mainFolder.id,
      drive_folder_url: folderUrl,
      raw_folder_id: rawFolder.id,
      project_folder_id: projectFolder.id,
      final_folder_id: finalFolder.id,
      created_by: 'dbe-flow',
    }
    const insertRes = await fetch(`${SB_URL}/rest/v1/video_projects`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(projectRow),
    })
    const inserted = await insertRes.json().catch(() => [])
    const project = Array.isArray(inserted) ? inserted[0] : inserted

    logDrive('create_video_project', 'video_project', project?.id, {
      title,
      client_name: clientName,
      folder_id: mainFolder.id,
    })

    return jsonRes({ ok: true, project: project ?? { ...projectRow, id: null }, folderUrl })
  } catch (err) {
    console.error('[drive-create-video-project]', err)
    return jsonRes({ error: err.message }, 500)
  }
}
