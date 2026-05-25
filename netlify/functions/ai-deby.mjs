// Deby AI — diretora de conteúdo da DBE, via OpenRouter.
// A chave da IA fica só aqui no servidor. Recebe { feature, prompt, context }.
const KEY = process.env.OPENROUTER_API_KEY
const BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
const MODEL = process.env.DEFAULT_AI_MODEL || 'openai/gpt-oss-120b:free'
// Modelos grátis oscilam (429/indisponível). Tentamos em cadeia até um responder.
const FALLBACKS = [
  MODEL,
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-20b:free',
]

// System prompts por funcionalidade. Deby é crítica, técnica e estratégica,
// focada em marketing médico SEM promessa de resultado (conformidade CFM).
const SYSTEM = {
  roteiro: 'Você é a Deby, diretora de conteúdo da DBE (marketing médico). Crie um roteiro de Reels com Gancho, Desenvolvimento e CTA. Linguagem clara, autoridade e método, SEM prometer resultado. Responda em português do Brasil.',
  analise: 'Você é a Deby. Analise criticamente o roteiro enviado avaliando gancho, tensão, prova e CTA. Dê uma nota de 0 a 10 e 3 melhorias objetivas. Português do Brasil.',
  objecoes: 'Você é a Deby, especialista comercial da DBE. Crie respostas persuasivas e éticas para objeções de preço em propostas de assessoria de marketing médico. Português do Brasil.',
  legenda: 'Você é a Deby. Escreva uma legenda de Instagram para marketing médico, segura e sem promessa de resultado, com chamada para salvar/compartilhar. Português do Brasil.',
  default: 'Você é a Deby, diretora de conteúdo e estrategista da DBE (assessoria de marketing médico). Seja prática, técnica e estratégica. Português do Brasil. Nunca prometa resultados clínicos.',
}

export default async (req) => {
  if (!KEY) return json({ error: 'OpenRouter não configurada (.env)' }, 500)
  const { feature = 'default', prompt, context } = await req.json().catch(() => ({}))
  if (!prompt) return json({ error: 'Informe o prompt' }, 400)

  const system = SYSTEM[feature] || SYSTEM.default
  const userContent = context ? `${prompt}\n\nContexto:\n${context}` : prompt
  const tried = [...new Set(FALLBACKS)] // remove duplicados mantendo a ordem

  let lastError = 'sem resposta'
  for (const model of tried) {
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${KEY}`,
          'HTTP-Referer': 'https://dbe-flow.netlify.app',
          'X-Title': 'DBE Flow',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
          temperature: 0.7,
        }),
      })
      const data = await res.json().catch(() => ({}))
      const text = data?.choices?.[0]?.message?.content
      if (res.ok && text) return json({ ok: true, text, model })
      lastError = data?.error?.message || `HTTP ${res.status}`
      // 429/indisponível: tenta o próximo modelo
    } catch (err) {
      lastError = err.message
    }
  }
  return json({ error: `IA indisponível: ${lastError}` }, 502)
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
