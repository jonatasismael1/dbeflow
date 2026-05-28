// Cliente Supabase do DBE Flow.
// Lê as chaves públicas do .env (VITE_*). Se não estiverem configuradas,
// o app continua funcionando em modo local (localStorage) — ver db.js.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// Só cria o cliente se houver URL + chave. Assim o app nunca quebra por
// falta de configuração.
export const supabase = url && anon ? createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
}) : null

export const isSupabaseConfigured = Boolean(supabase)

export async function getAccessToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}
