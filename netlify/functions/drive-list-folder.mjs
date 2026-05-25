// Lista arquivos e pastas de uma pasta do Google Drive acessivel pela conta conectada.
import { ROOT_FOLDER_ID, driveReq, driveUrl, fileUrl, jsonRes } from './lib/google-drive.mjs'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export default async (req) => {
  const { folderId = ROOT_FOLDER_ID } = await req.json().catch(() => ({}))

  try {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,webViewLink,modifiedTime,size,iconLink)',
      orderBy: 'folder,name',
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })
    const folderParams = new URLSearchParams({
      fields: 'id,name,webViewLink,parents',
      supportsAllDrives: 'true',
    })

    const [folderRes, filesRes] = await Promise.all([
      driveReq(`/files/${folderId}?${folderParams}`),
      driveReq(`/files?${params}`),
    ])

    if (!folderRes.ok) return jsonRes({ error: folderRes.data?.error?.message || 'Nao foi possivel abrir a pasta' }, folderRes.status)
    if (!filesRes.ok) return jsonRes({ error: filesRes.data?.error?.message || 'Nao foi possivel listar arquivos' }, filesRes.status)

    const files = (filesRes.data.files || []).map((item) => ({
      ...item,
      isFolder: item.mimeType === FOLDER_MIME,
      url: item.webViewLink || (item.mimeType === FOLDER_MIME ? driveUrl(item.id) : fileUrl(item.id)),
    }))

    return jsonRes({ ok: true, folder: folderRes.data, files, rootFolderId: ROOT_FOLDER_ID })
  } catch (err) {
    return jsonRes({ error: err.message }, 500)
  }
}

