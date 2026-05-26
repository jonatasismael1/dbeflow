// Vincula uma pasta existente do Drive ao cadastro de um cliente.
import { SB_URL, sbHeaders, driveReq, driveUrl, logDrive, jsonRes } from './lib/google-drive.mjs'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export default async (req) => {
  const { clientId, folderId } = await req.json().catch(() => ({}))
  if (!clientId || !folderId) return jsonRes({ error: 'clientId e folderId sao obrigatorios' }, 400)

  try {
    const params = new URLSearchParams({
      fields: 'id,name,mimeType,webViewLink',
      supportsAllDrives: 'true',
    })
    const folderRes = await driveReq(`/files/${folderId}?${params}`)
    if (!folderRes.ok) return jsonRes({ error: folderRes.data?.error?.message || 'Pasta nao encontrada' }, folderRes.status)
    if (folderRes.data.mimeType !== FOLDER_MIME) return jsonRes({ error: 'Selecione uma pasta do Drive' }, 400)

    const clientRes = await fetch(
      `${SB_URL}/rest/v1/dbe_clients?id=eq.${clientId}&select=id,data`,
      { headers: sbHeaders },
    )
    const clients = await clientRes.json().catch(() => [])
    const currentData = Array.isArray(clients) && clients[0] ? clients[0].data || {} : {}
    const folderUrl = folderRes.data.webViewLink || driveUrl(folderId)

    // Atualiza o banco se o cliente existir; se não, continua mesmo assim
    // pois o frontend (updateItem) salva o drive_folder_id no estado local
    if (Array.isArray(clients) && clients[0]) {
      await fetch(`${SB_URL}/rest/v1/dbe_clients?id=eq.${clientId}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({
          data: { ...currentData, drive_folder_id: folderId, drive_folder_url: folderUrl },
        }),
      })
    }

    logDrive('link_client_folder', 'client', clientId, { folder_id: folderId, folder_name: folderRes.data.name })

    return jsonRes({ ok: true, folderId, folderUrl, folderName: folderRes.data.name })
  } catch (err) {
    return jsonRes({ error: err.message }, 500)
  }
}
