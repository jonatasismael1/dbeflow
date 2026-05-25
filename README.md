# DBE Flow

Sistema operacional da DBE (assessoria de marketing médico). Funciona como app
único do dia a dia da agência e está pronto para virar SaaS.

- **Banco na nuvem:** Supabase (projeto `DBE-flow`)
- **WhatsApp:** Evolution API (enviar/receber mensagens)
- **IA Deby:** OpenRouter (roteiros, legendas, análises)
- **Instagram:** Meta Graph API (contas, insights, publicação)

## Módulos
Central executiva · Clientes · CRM/pipeline · Diagnóstico (com link público) ·
Onboarding · Contratos · Roteiros · Teleprompter · Deby AI · Instagram Studio ·
Conversas (WhatsApp) · Financeiro · Integrações.

## Como rodar

As chaves ficam no `.env` (já preenchido). O front só enxerga `VITE_*`; as
chaves secretas (Evolution, Meta, OpenRouter) só rodam nas Netlify Functions.

```bash
npm install

# Opção A — só o app (banco Supabase funciona; WhatsApp/IA/Meta NÃO,
# porque dependem das funções serverless):
npm run dev

# Opção B — app + funções serverless (recomendado p/ testar tudo):
npm install -g netlify-cli   # uma vez
netlify dev
```

> Sem `netlify dev`, os botões de WhatsApp/IA/Meta avisam que a função não está
> disponível. O resto do app (dados na nuvem) funciona normalmente.

## Conectar o WhatsApp
1. Abra **Integrações** no app.
2. Clique em **Conectar / QR** e escaneie o QR com o WhatsApp da agência
   (Aparelhos conectados).
3. Depois do deploy, aponte o webhook da instância para
   `https://SEU-SITE.netlify.app/api/whatsapp-webhook` (para receber mensagens).

## Deploy (Netlify)
1. Suba a pasta `dbe-flow` para o Netlify (build: `npm run build`, publish: `dist`).
2. Cadastre **todas** as variáveis do `.env` em *Site settings → Environment variables*.
3. Configure o webhook do WhatsApp (passo acima).

## Banco de dados
- Migrações em [`supabase/migrations/`](./supabase/migrations).
- Aplicar/atualizar: `node scripts/apply-migration.mjs supabase/migrations/ARQUIVO.sql`
  (usa `SUPABASE_ACCESS_TOKEN` do `.env`).

## Documentação
`docs/PRD.md` · `docs/AUDITORIA.md` · `docs/PLANO_IMPLEMENTACAO.md`
