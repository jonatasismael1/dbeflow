// Salva metadados de um arquivo já enviado ao Drive.
// Chamado pelo frontend após o upload resumable completar com sucesso.
// Body: { videoProjectId, driveFileId, driveFolderId, fileName, mimeType, fileSize, category, uploadedBy }
// Se category = 'final', atualiza o status do projeto para 'revisao'.
import { SB_URL, sbHeaders, fileUrl, logDrive, jsonRes } from './lib/google-drive.mjs'

export default async (req) => {
  const {
    videoProjectId,
    driveFileId,
    driveFolderId,
    fileName,
    mimeType,
    fileSize,
    category = 'bruto',
    uploadedBy = 'dbe-flow',
  } = await req.json().catch(() => ({}))

  if (!videoProjectId || !driveFileId || !fileName) {
    return jsonRes({ error: 'videoProjectId, driveFileId e fileName são obrigatórios' }, 400)
  }

  try {
    const row = {
      video_project_id: videoProjectId,
      drive_file_id: driveFileId,
      drive_folder_id: driveFolderId || null,
      file_name: fileName,
      mime_type: mimeType || null,
      file_size: fileSize ? Number(fileSize) : null,
      category,
      file_url: fileUrl(driveFileId),
      uploaded_by: uploadedBy,
    }

    const insertRes = await fetch(`${SB_URL}/rest/v1/video_project_files`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(row),
    })
    const inserted = await insertRes.json().catch(() => [])
    const file = Array.isArray(inserted) ? inserted[0] : inserted

    // Se é o arquivo final, avança o status do projeto para revisão
    if (category === 'final') {
      await fetch(`${SB_URL}/rest/v1/video_projects?id=eq.${videoProjectId}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({ status: 'revisao' }),
      })
    }
    // Se é o primeiro bruto, marca como brutos_enviados
    if (category === 'bruto') {
      await fetch(`${SB_URL}/rest/v1/video_projects?id=eq.${videoProjectId}&status=eq.gravado`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({ status: 'brutos_enviados' }),
      })
    }

    logDrive('upload_file', 'video_project_file', videoProjectId, {
      file_name: fileName,
      category,
      drive_file_id: driveFileId,
      uploaded_by: uploadedBy,
    }, uploadedBy)

    return jsonRes({ ok: true, file: file ?? row })
  } catch (err) {
    console.error('[drive-save-file]', err)
    return jsonRes({ error: err.message }, 500)
  }
}
