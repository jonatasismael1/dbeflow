// Aplica um arquivo .sql no projeto Supabase via Management API.
// Uso: node scripts/apply-migration.mjs supabase/migrations/0001_init.sql
// Requer SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF no .env (ou variáveis de ambiente).
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
config()

const REF = process.env.SUPABASE_PROJECT_REF || 'natupmkvyvhdhjgvvgtp'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!TOKEN) { console.error('Defina SUPABASE_ACCESS_TOKEN no .env'); process.exit(1) }
const file = process.argv[2]
if (!file) { console.error('Informe o arquivo .sql'); process.exit(1) }

const query = readFileSync(file, 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})

const text = await res.text()
if (!res.ok) { console.error('ERRO', res.status, text); process.exit(1) }
console.log('OK', res.status, text.slice(0, 500))
