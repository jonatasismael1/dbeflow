// Gera o contrato oficial DBE preenchido com os dados do cliente.
// Usa o template "Contrato DBE oficial.docx" via docxtemplater.
// Retorna o DOCX em base64 para download direto no browser.
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async (req) => {
  const data = await req.json().catch(() => ({}))
  if (!data.nome) return json({ error: 'Informe o nome do contratante' }, 400)

  try {
    const content = readFileSync(join(__dirname, 'contract-template.docx'), 'binary')
    const zip = new PizZip(content)

    // Substitui o nome de cliente hardcoded no corpo do contrato antes do templating.
    // "Dra Cecília Bernardes" está na cláusula 1.1 e precisa ser dinâmico.
    const xmlPath = 'word/document.xml'
    if (zip.file(xmlPath)) {
      let xml = zip.file(xmlPath).asText()
      // Substitui qualquer variação do nome exemplo por placeholder
      xml = xml.replace(/Dra\s+Cec[^<"']*Bernardes/g, data.descricao_cliente || data.nome)
      // Remove CPF hardcoded duplicado que ficou no template (030.869.194-69{{cpf...}})
      xml = xml.replace(/030\.869\.194-69\{\{cpf_do_contratante\}\}/g, '{{cpf_do_contratante}}')
      zip.file(xmlPath, xml)
    }

    const doc = new Docxtemplater(zip, {
      delimiters: { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks: true,
    })

    const meses = Number(data.meses || 6)
    const videosMes = Number(data.videos_mes || 4)
    const artesMes = Number(data.artes_mes || 4)
    const valorParcela = Number(data.valor_parcela || 0)
    const parcelas = Number(data.parcelas || meses)
    const valorTotal = valorParcela * parcelas

    doc.render({
      nome_do_contratante: data.nome,
      rg_do_contratante: data.rg || '',
      cpf_do_contratante: data.cpf || '',
      nome_da_rua: data.rua || '',
      'número_da_casa': data.numero || '',
      bairro: data.bairro || '',
      CEP: data.cep || '',
      'total_de_vídeos': String(videosMes * meses),
      total_de_artes: String(artesMes * meses),
      'número_de_meses': String(meses),
      valor_do_contrato: brl(valorTotal),
      quantidade_de_parcela: String(parcelas),
      valor_da_parcela: brl(valorParcela),
      dia_do_pagamento: String(data.dia_pagamento || 5),
    })

    const buf = doc.getZip().generate({ type: 'nodebuffer' })
    const base64 = buf.toString('base64')

    // Salva no Supabase Storage se possível (bucket dbe-docs deve existir)
    let publicUrl = null
    if (SB_URL && SB_KEY && data.contract_id) {
      const fileName = `contracts/${data.contract_id}-${data.nome.replace(/\s+/g, '-')}.docx`
      const upload = await fetch(`${SB_URL}/storage/v1/object/dbe-docs/${fileName}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'x-upsert': 'true',
        },
        body: buf,
      }).catch(() => null)
      if (upload?.ok) {
        publicUrl = `${SB_URL}/storage/v1/object/public/dbe-docs/${fileName}`
      }
    }

    return json({ ok: true, base64, publicUrl })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
}

function brl(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
