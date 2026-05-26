// Cria uma pasta no Google Drive para o cliente, dentro da pasta raiz da agência.
// Idempotente: se o cliente já tiver drive_folder_id salvo, retorna o existente.
// Body: { clientId, clientName }
import {
  getValidToken,
  createDriveFolder,
  ROOT_FOLDER_ID,
  SB_URL,
  sbHeaders,
  driveUrl,
  logDrive,
  jsonRes,
} from './lib/google-drive.mjs'

export default async (req) => {
  const { clientId, clientName } = await req.json().catch(() => ({}))
  if (!clientId || !clientName) return jsonRes({ error: 'clientId e clientName são obrigatórios' }, 400)

  try {
    // Verifica se o cliente já tem pasta (campo drive_folder_id no JSONB data)
    const clientRes = await fetch(
      `${SB_URL}/rest/v1/dbe_clients?id=eq.${clientId}&select=id,data`,
      { headers: sbHeaders },
    )
    const clients = await clientRes.json().catch(() => [])
    const existing = clients[0]?.data?.drive_folder_id

    if (existing) {
      return jsonRes({
        ok: true,
        folderId: existing,
        folderUrl: driveUrl(existing),
        already_existed: true,
      })
    }

    const token = await getValidToken()

    // Cria a pasta do cliente dentro da pasta raiz
    const folder = await createDriveFolder(clientName, ROOT_FOLDER_ID, token)

    const folderUrl = driveUrl(folder.id)

    // Atualiza o JSONB do cliente no Supabase
    const currentData = clients[0]?.data || {}
    await fetch(`${SB_URL}/rest/v1/dbe_clients?id=eq.${clientId}`, {
      method: 'PATCH',
      headers: sbHeaders,
      body: JSON.stringify({
        data: { ...currentData, drive_folder_id: folder.id, drive_folder_url: folderUrl },
      }),
    })

    logDrive('create_client_folder', 'client', clientId, { folder_id: folder.id, client_name: clientName })

    return jsonRes({ ok: true, folderId: folder.id, folderUrl })
  } catch (err) {
    console.error('[drive-create-client-folder]', err)
    return jsonRes({ error: err.message }, 500)
  }
}
