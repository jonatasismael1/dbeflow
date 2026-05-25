# evolution-skill — Guia para IA: Construindo WhatsApp + Evolution API + Supabase

> **Para IAs:** Este documento explica, passo a passo, como criar uma integração WhatsApp completa
> usando Evolution API v2 + Supabase (Edge Functions, PostgreSQL, Realtime, Storage) + React/TypeScript.
> Siga exatamente esta sequência para evitar os bugs que já foram resolvidos aqui.

---

## Visão Geral da Arquitetura

```
WhatsApp (usuário final)
    ↓ mensagem recebida
Evolution API (VPS — Coolify ou Docker)
    ↓ POST webhook
[Supabase Edge Function] evolution-webhook
    ↓ INSERT (usando service_role key, bypassa RLS)
whatsapp_mensagens (PostgreSQL)
    ↓ Supabase Realtime (postgres_changes)
Frontend React (atualiza UI instantaneamente)

Frontend React (usuário envia mensagem)
    ↓ chama [Supabase Edge Function] quick-action
    ↓ HTTP para Evolution API
Evolution API envia mensagem WhatsApp
    + Frontend insere mensagem direto no banco (direcao: 'out')
```

**REGRA CRÍTICA:** Nunca chamar a Evolution API diretamente do frontend. Sempre via Edge Function `quick-action`.

---

## Parte 1 — Banco de Dados (Supabase PostgreSQL)

### 1.1 Tabelas necessárias

Execute as migrations abaixo na ordem:

```sql
-- Contatos WhatsApp
CREATE TABLE whatsapp_contatos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  chat_id         TEXT NOT NULL,          -- ex: "5511999999999@s.whatsapp.net"
  telefone        TEXT,
  push_name       TEXT,                   -- nome do contato no WhatsApp
  profile_pic_url TEXT,                   -- URL da foto de perfil
  pic_fetched_at  TIMESTAMPTZ,            -- quando a foto foi buscada pela última vez
  origem          TEXT DEFAULT 'manual',  -- 'evolution' | 'manual'
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinica_id, chat_id)
);

-- Conversas
CREATE TABLE whatsapp_conversas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id         UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  chat_id            TEXT NOT NULL,
  contato_id         UUID REFERENCES whatsapp_contatos(id),
  lead_id            UUID REFERENCES leads(id),
  status             TEXT NOT NULL DEFAULT 'aberta',
  atendimento_status TEXT NOT NULL DEFAULT 'novo',  -- novo|ativo|paciente|arquivado|humano
  unread_count       INT NOT NULL DEFAULT 0,
  ai_enabled         BOOLEAN NOT NULL DEFAULT false,
  ai_mode            TEXT NOT NULL DEFAULT 'assisted', -- 'automatic' | 'assisted'
  human_takeover     BOOLEAN NOT NULL DEFAULT false,
  ultimo_texto       TEXT,
  ultima_mensagem_em TIMESTAMPTZ,
  criada_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinica_id, chat_id)
);

-- Mensagens
-- ATENÇÃO: o CHECK constraint em "direcao" aceita APENAS 'in' e 'out' (inglês)
CREATE TABLE whatsapp_mensagens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  conversa_id     UUID NOT NULL REFERENCES whatsapp_conversas(id) ON DELETE CASCADE,
  contato_id      UUID REFERENCES whatsapp_contatos(id),
  waha_message_id TEXT,      -- ID da mensagem na Evolution API (para deduplicação)
  direcao         TEXT NOT NULL CHECK (direcao IN ('in', 'out')),
  tipo            TEXT NOT NULL DEFAULT 'text',  -- text|image|video|audio|document|sticker
  texto           TEXT,
  media_url       TEXT,
  payload         JSONB NOT NULL DEFAULT '{}',
  enviada_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX ON whatsapp_mensagens (conversa_id, enviada_em);
CREATE INDEX ON whatsapp_conversas (clinica_id, ultima_mensagem_em DESC);

-- Índice único para deduplicação por waha_message_id
CREATE UNIQUE INDEX whatsapp_mensagens_wamid_idx
  ON whatsapp_mensagens (clinica_id, waha_message_id)
  WHERE waha_message_id IS NOT NULL;

-- Índice parcial para contar não lidos rapidamente
CREATE INDEX whatsapp_conversas_unread_idx
  ON whatsapp_conversas (clinica_id)
  WHERE unread_count > 0;
```

### 1.2 RLS Policies

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE whatsapp_contatos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_mensagens  ENABLE ROW LEVEL SECURITY;

-- Política padrão: staff da clínica acessa
-- (adapte is_clinic_staff para sua função de verificação de role)
CREATE POLICY "clinic_staff" ON whatsapp_contatos
  USING (is_clinic_staff(clinica_id));

CREATE POLICY "clinic_staff" ON whatsapp_conversas
  USING (is_clinic_staff(clinica_id));

CREATE POLICY "clinic_staff" ON whatsapp_mensagens
  USING (is_clinic_staff(clinica_id));
```

### 1.3 Habilitar Realtime

```sql
-- Adicionar tabela de mensagens à publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_mensagens;
```

### 1.4 Storage para mídia

```sql
-- Criar bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('whatsapp-media', 'whatsapp-media', true, 52428800);  -- 50MB

-- RLS: autenticados podem fazer upload
CREATE POLICY "authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-media');

-- RLS: leitura pública (para exibir mídias no chat)
CREATE POLICY "public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'whatsapp-media');
```

---

## Parte 2 — Edge Function: `quick-action`

Esta função é o **gateway central** entre o frontend e a Evolution API.

### 2.1 Configurar a Edge Function

Criar em `supabase/functions/quick-action/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const EVOLUTION_URL  = Deno.env.get("EVOLUTION_API_URL")!;   // ex: https://minha-evolution.com
const EVOLUTION_KEY  = Deno.env.get("EVOLUTION_API_KEY")!;   // apikey do painel Evolution
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const body = await req.json();
    const { action, instanceName, ...params } = body;

    let method = "GET";
    let path = "";
    let payload: unknown = undefined;

    switch (action) {
      case "fetch_instances":
        path = "/instance/fetchInstances";
        break;

      case "create_instance":
        method = "POST";
        path = "/instance/create";
        payload = { instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true };
        break;

      case "connect_instance":
        path = `/instance/connect/${instanceName}`;
        break;

      case "get_status":
        path = `/instance/connectionState/${instanceName}`;
        break;

      case "logout_instance":
        method = "DELETE";
        path = `/instance/logout/${instanceName}`;
        break;

      case "delete_instance":
        method = "DELETE";
        path = `/instance/delete/${instanceName}`;
        break;

      case "set_webhook":
        method = "POST";
        path = `/webhook/set/${instanceName}`;
        payload = {
          webhook: {
            enabled: true,
            url: params.webhookUrl,
            webhookByEvents: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"]
          }
        };
        break;

      case "send_text":
        method = "POST";
        path = `/message/sendText/${instanceName}`;
        payload = { number: params.number, text: params.text };
        break;

      case "send_media":
        method = "POST";
        // Áudio usa endpoint diferente
        path = params.mediaType === "audio"
          ? `/message/sendWhatsAppAudio/${instanceName}`
          : `/message/sendMedia/${instanceName}`;
        payload = {
          number: params.number,
          mediatype: params.mediaType,
          media: params.mediaUrl,
          caption: params.caption ?? "",
          fileName: params.fileName ?? "",
          mimetype: params.mimeType ?? "application/octet-stream",
        };
        break;

      default:
        return new Response(
          JSON.stringify({ ok: false, error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
    }

    const url = `${EVOLUTION_URL}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_KEY,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    // IMPORTANTE: sempre retornar envelope com data aninhado
    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, url, data }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
```

### 2.2 Variáveis de ambiente no Supabase

No dashboard Supabase → Edge Functions → Secrets:
```
EVOLUTION_API_URL = https://sua-evolution-api.com
EVOLUTION_API_KEY = sua-api-key-aqui
```

### 2.3 Deploy

```bash
supabase functions deploy quick-action
```

---

## Parte 3 — Edge Function: `evolution-webhook`

Recebe eventos da Evolution API e persiste mensagens no banco.

**ATENÇÃO:** Esta função DEVE ter `verify_jwt: false` porque a Evolution API não envia JWT.

### 3.1 Arquivo `supabase/functions/evolution-webhook/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;  // bypassa RLS

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" }
    });
  }

  const url = new URL(req.url);
  const clinicId = url.searchParams.get("clinicId");
  if (!clinicId) return new Response("clinicId ausente", { status: 400 });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response("JSON inválido", { status: 400 }); }

  // Normaliza nome do evento — Evolution API pode enviar "MESSAGES_UPSERT", "messages.upsert", etc.
  const eventRaw = String(body.event ?? body.type ?? "");
  const event = eventRaw.toLowerCase().replace(/[^a-z]/g, "");

  if (event === "messagesupsert") {
    await handleMessagesUpsert(supabase, body, clinicId);
  }
  // Adicione outros eventos conforme necessário (connection_update, qrcode_updated, etc.)

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
});

async function handleMessagesUpsert(supabase: any, body: Record<string, unknown>, clinicId: string) {
  const messages = Array.isArray(body.data) ? body.data :
                   Array.isArray(body.messages) ? body.messages : [];

  for (const msg of messages) {
    const key = (msg.key ?? {}) as Record<string, unknown>;
    const fromMe = Boolean(key.fromMe);

    // IMPORTANTE: pula mensagens enviadas pelo SaaS (já inseridas diretamente pelo frontend)
    if (fromMe) continue;

    const chatId   = String(key.remoteJid ?? "");
    const msgId    = String(key.id ?? "");
    const msgData  = (msg.message ?? {}) as Record<string, unknown>;
    const pushName = String(msg.pushName ?? msg.notifyName ?? "");

    // Extrai texto da mensagem (diferentes tipos)
    const texto =
      String(msgData.conversation ?? msgData.extendedTextMessage?.text ?? "").trim() || null;

    // Upsert contato → obter ID confiável via SELECT separado
    const contatoId = await upsertAndGet(
      supabase,
      "whatsapp_contatos",
      { clinica_id: clinicId, chat_id: chatId, nome: pushName || null, telefone: chatId.split("@")[0] },
      "clinica_id,chat_id",
      "chat_id", chatId, clinicId
    );
    if (!contatoId) continue;

    // Upsert conversa → obter ID confiável via SELECT separado
    const conversaId = await upsertAndGet(
      supabase,
      "whatsapp_conversas",
      {
        clinica_id: clinicId,
        chat_id: chatId,
        contato_id: contatoId,
        ultimo_texto: texto,
        ultima_mensagem_em: new Date().toISOString(),
      },
      "clinica_id,chat_id",
      "chat_id", chatId, clinicId
    );
    if (!conversaId) continue;

    // Atualiza ultimo_texto na conversa
    await supabase.from("whatsapp_conversas")
      .update({ ultimo_texto: texto, ultima_mensagem_em: new Date().toISOString() })
      .eq("id", conversaId);

    // Insere mensagem — direcao: "in" (CHECK constraint só aceita 'in' ou 'out')
    await supabase.from("whatsapp_mensagens").upsert({
      clinica_id: clinicId,
      conversa_id: conversaId,
      contato_id: contatoId,
      direcao: "in",  // NUNCA usar "entrada", "saida" ou outros valores
      tipo: "text",
      texto,
      payload: msg,
      enviada_em: new Date().toISOString(),
    }, { onConflict: "id", ignoreDuplicates: true });
  }
}

// PADRÃO upsertAndGet: upsert NÃO retorna ID confiável em conflito UPDATE no Supabase
// → sempre fazer SELECT separado depois do upsert
async function upsertAndGet(
  supabase: any,
  table: string,
  row: Record<string, unknown>,
  conflict: string,
  lookupCol: string,
  lookupVal: string,
  clinicId: string
): Promise<string | null> {
  await supabase.from(table).upsert(row, { onConflict: conflict });
  const { data } = await supabase.from(table).select("id")
    .eq("clinica_id", clinicId)
    .eq(lookupCol, lookupVal)
    .single();
  return data?.id ?? null;
}
```

### 3.2 Configuração `verify_jwt: false`

Criar `supabase/functions/evolution-webhook/config.toml`:
```toml
[functions.evolution-webhook]
verify_jwt = false
```

### 3.3 Deploy

```bash
supabase functions deploy evolution-webhook --no-verify-jwt
```

---

## Parte 4 — Configurar Webhook na Evolution API

Após criar/conectar uma instância, configure o webhook:

```typescript
// No frontend, via quickActionService
await setInstanceWebhook(instanceName, clinicId);
// Isso chama quick-action com action: "set_webhook"
// URL gerada: {SUPABASE_URL}/functions/v1/evolution-webhook?clinicId={clinicId}
```

A Evolution API vai enviar um POST para essa URL a cada evento.

---

## Parte 5 — Serviço Frontend (`quickActionService.ts`)

```typescript
import { supabase } from "../lib/supabaseClient";

export const DEFAULT_INSTANCE_NAME = "nome-da-sua-instancia";

async function callQuickAction<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data: envelope, error } = await supabase.functions.invoke("quick-action", { body });

  if (error) throw new Error((error as Error)?.message ?? "Erro de comunicação.");

  // SEMPRE verificar envelope.ok — a Edge Function retorna sempre HTTP 200
  // O status real da Evolution API fica em envelope.ok
  if (!envelope?.ok) {
    const inner = envelope?.data as Record<string, unknown> | undefined;
    const msg = inner?.error ?? inner?.message ?? envelope?.error ?? "Erro na operação.";
    throw new Error(String(msg));
  }

  // SEMPRE retornar envelope.data — a resposta real está aninhada aqui
  return envelope.data as T;
}

export async function sendWhatsAppText(instanceName: string, phone: string, text: string) {
  await callQuickAction({ action: "send_text", instanceName, number: phone, text });
}

export async function setInstanceWebhook(instanceName: string, clinicId: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?clinicId=${clinicId}`;
  await callQuickAction({ action: "set_webhook", instanceName, webhookUrl });
}

// ... outros métodos seguem o mesmo padrão
```

---

## Parte 6 — Realtime no Frontend (React)

```typescript
import { supabase } from "../lib/supabaseClient";

// Dentro do componente, no useEffect:
useEffect(() => {
  const channel = supabase
    .channel(`wa_msgs_${clinicId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_mensagens",
        filter: `clinica_id=eq.${clinicId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;

        // Só atualiza UI se a mensagem é da conversa aberta
        if (row.conversa_id === selectedConversationId) {
          setMessages(prev => {
            // Deduplica — mensagens enviadas pelo próprio SaaS já estão na lista
            if (prev.some(m => m.id === (row.id as string))) return prev;
            return [...prev, {
              id: row.id as string,
              direction: row.direcao === "out" ? "out" : "in",
              messageType: "text",
              content: row.texto as string | null,
              mediaUrl: null,
              status: null,
              sentAt: row.enviada_em as string,
            }];
          });
        }

        // Atualiza lista de conversas (ultimo_texto, hora)
        loadConversations(clinicId).then(setConversations).catch(() => null);
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [clinicId, selectedConversationId]);
```

---

## Parte 7 — Enviando Mensagens (handleSend)

```typescript
async function handleSend(text: string) {
  const nowIso = new Date().toISOString();

  // 1. Envia via Evolution API
  await sendWhatsAppText(DEFAULT_INSTANCE_NAME, conversation.contact.phone, text);

  // 2. Insere no banco como "out" — NÃO espere o webhook echo (fromMe é pulado no webhook)
  await supabase.from("whatsapp_mensagens").insert({
    clinica_id: clinicId,
    conversa_id: conversation.id,
    contato_id: conversation.contactId,
    direcao: "out",           // CHECK constraint aceita 'in' ou 'out'
    tipo: "text",
    texto: text,
    payload: {},
    enviada_em: nowIso,
  });

  // 3. O Realtime vai detectar o INSERT e atualizar a UI automaticamente
  //    (ou você pode atualizar o estado local imediatamente para feedback instantâneo)
}
```

---

## Parte 8 — UI do Chat (WhatsApp Style)

```tsx
// Fundo do chat
<div style={{ background: "#efeae2" }} className="flex-1 overflow-y-auto p-4">

// Bolha de mensagem
function MessageBubble({ msg }: { msg: WhatsAppMessage }) {
  const isOut = msg.direction === "out";

  return (
    <div className={`flex mb-2 ${isOut ? "justify-end" : "justify-start"}`}>
      <div className={`
        relative max-w-[72%] px-3 py-2 text-sm shadow-sm
        ${isOut
          ? "rounded-[10px] rounded-br-[2px] bg-[#d9fdd3] text-[#111b21]"
          : "rounded-[10px] rounded-bl-[2px] bg-white text-[#111b21]"
        }
      `}>
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        <span className="text-[10px] text-[#667085] float-right mt-1 ml-3">
          {new Date(msg.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
```

---

## Parte 9 — Armadilhas Conhecidas (Bugs que Já Foram Resolvidos)

### ❌ Bug 1: `direcao` CHECK constraint

**Problema:** Inserir `"entrada"` ou `"saida"` no campo `direcao` causa violação silenciosa.
**Solução:** Sempre usar `"in"` (recebida) ou `"out"` (enviada). Verificar com:
```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname LIKE '%direcao%';
```

### ❌ Bug 2: Upsert não retorna ID confiável

**Problema:** `supabase.from("tabela").upsert(...).select("id").single()` retorna null quando há conflito UPDATE.
**Solução:** Sempre usar o padrão `upsertAndGet` — upsert seguido de SELECT separado.

### ❌ Bug 3: `envelope.data` vs resposta raiz

**Problema:** `quick-action` sempre retorna `{ ok, status, url, data }`. Tentar ler `data.code` quando o valor real está em `data.data.code`.
**Solução:** Em `callQuickAction`, sempre retornar `envelope.data` — nunca o envelope inteiro.

### ❌ Bug 4: Mensagens do celular não aparecem (fromMe)

**Problema original:** Webhook tinha `if (fromMe) continue` — pulava todas as mensagens enviadas pelo celular físico.
**Solução correta:** Remover o skip de `fromMe`. O webhook deve salvar TODAS as mensagens:
- `fromMe: false` → `direcao: "in"` (recebida do contato)
- `fromMe: true` → `direcao: "out"` (enviada — do celular OU do painel)

**Deduplicação via `waha_message_id`:** Para evitar duplicação quando o painel envia (o webhook recebe o echo `fromMe: true`), capturar o `key.id` da resposta da Evolution API e salvar em `waha_message_id`. O webhook checa se já existe antes de inserir:
```typescript
// No webhook: checar antes de inserir
if (messageId) {
  const { count } = await supabase
    .from("whatsapp_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicId)
    .eq("waha_message_id", messageId);
  if ((count ?? 0) > 0) continue; // já existe, pula
}

// No frontend (handleSend): capturar wamid da resposta
const data = await callQuickAction({ action: "send_text", ... });
const wamid = data?.key?.id ?? null;
// Inserir no banco com waha_message_id: wamid
```

Schema adicional necessário:
```sql
ALTER TABLE whatsapp_mensagens ADD COLUMN waha_message_id TEXT;
CREATE UNIQUE INDEX whatsapp_mensagens_wamid_idx
  ON whatsapp_mensagens (clinica_id, waha_message_id)
  WHERE waha_message_id IS NOT NULL;
```

### ❌ Bug 5: Nome de evento inconsistente

**Problema:** Evolution API pode enviar `"MESSAGES_UPSERT"`, `"messages.upsert"`, `"messageUpsert"`, etc.
**Solução:** Normalizar: `event.toLowerCase().replace(/[^a-z]/g, "")` → compara com `"messagesupsert"`.

### ❌ Bug 6: `verify_jwt: false` não configurado

**Problema:** Webhook da Evolution API chega sem JWT → Supabase rejeita com 401.
**Solução:** Criar `config.toml` com `verify_jwt = false` E fazer deploy com `--no-verify-jwt`.

### ❌ Bug 7: Frontend chama Evolution API diretamente

**Problema:** CORS, exposição de API key, sem controle de tenant.
**Solução:** 100% das chamadas à Evolution API via Edge Function `quick-action`. Sem exceção.

### ❌ Bug 8: Contatos não aparecem na lista

**Problema:** Evolution API envia evento `CONTACTS_UPSERT` automaticamente ao conectar uma instância, mas o webhook não tratava esse evento.
**Solução:** Adicionar handler para `contacts.upsert` no webhook:
```typescript
const eventKey = event.toLowerCase().replace(/[^a-z]/g, "");
if (eventKey === "contactsupsert" || eventKey === "contactsupserted") {
  await handleContactsUpsert(supabase, clinicId, data);
}
```
**Alternativa:** Ação `fetch_contacts` no `quick-action` com `POST /contact/fetchContacts/{instance}` body `{ where: {} }`.

Para popular contatos: desconectar e reconectar a instância WhatsApp — a Evolution API dispara `CONTACTS_UPSERT` com todos os contatos.

### ❌ Bug 9: Figurinhas (stickers) aparecem em tamanho enorme

**Problema:** `stickerMessage` era mapeado para tipo `"image"` e renderizado com `w-full` no `MediaPreview`.
**Solução:** Tipo separado `"sticker"` no `detectTipo()` do webhook, e no frontend renderizar com tamanho fixo:
```typescript
// webhook
if (msgBody.stickerMessage) return "sticker";
if (msgBody.imageMessage)   return "image";

// frontend MediaPreview
if (message.messageType === "sticker") {
  return <img className="max-h-28 max-w-[120px] object-contain" src={message.mediaUrl} />;
}
```

### ❌ Bug 10: Links nas mensagens não são clicáveis

**Problema:** Conteúdo das mensagens renderizado como `<p>` puro — URLs viram texto.
**Solução:** Função `linkify()` que divide o texto por URLs e envolve em `<a>`:
```typescript
function linkify(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline text-blue-600">{part}</a>
      : part
  );
}
// Uso: <p>{linkify(message.content)}</p>
```

### ❌ Bug 11: Módulo reseta para Dashboard ao voltar de outra aba

**Problema:** `activeModule` em `AdminPage.tsx` era `useState("Dashboard")` — não persistia.
**Solução:** Inicializar do `sessionStorage` e salvar ao trocar:
```typescript
const [activeModule, setActiveModule] = useState<Module>(
  () => (sessionStorage.getItem("clinicpro_module") as Module) ?? "Dashboard"
);
const changeModule = (m: Module) => {
  sessionStorage.setItem("clinicpro_module", m);
  setActiveModule(m);
};
```

---

## Checklist de Deploy

### Banco de Dados
- [ ] Tabelas criadas com CHECK constraint correto em `direcao` (`'in'` | `'out'`)
- [ ] Colunas extras em `whatsapp_contatos`: `push_name`, `profile_pic_url`, `pic_fetched_at`, `origem`
- [ ] Colunas extras em `whatsapp_conversas`: `atendimento_status`, `unread_count`, `ai_enabled`, `ai_mode`, `human_takeover`
- [ ] Coluna `waha_message_id` em `whatsapp_mensagens` com UNIQUE INDEX parcial
- [ ] RLS habilitada em todas as tabelas WhatsApp
- [ ] `whatsapp_mensagens` adicionada à publicação Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_mensagens`
- [ ] Bucket `whatsapp-media` criado como público com limite de 50MB

### Edge Functions
- [ ] `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` nos secrets do Supabase
- [ ] `quick-action` deployed (com `verify_jwt: true` — usa anon key do frontend)
- [ ] `evolution-webhook` deployed com `verify_jwt: false` (Evolution API não envia JWT)
- [ ] webhook handler `CONTACTS_UPSERT` implementado (popula contatos ao conectar)
- [ ] `fromMe: true` NÃO é skipado — salvo como `direcao: "out"`, deduplicado por `waha_message_id`

### Frontend
- [ ] `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`
- [ ] `callQuickAction` lê `envelope.data` (não o envelope inteiro)
- [ ] `sendWhatsAppText`/`sendWhatsAppMedia` capturam `data?.key?.id` como `wamid`
- [ ] `waha_message_id` salvo ao inserir mensagem enviada pelo painel
- [ ] `activeModule` persistido em `sessionStorage` para não resetar ao trocar de aba
- [ ] Links renderizados com `linkify()` — URLs clicáveis no chat
- [ ] Stickers com tipo `"sticker"` e tamanho fixo `max-h-28 max-w-[120px]`
- [ ] Drawer de info do contato acessível no mobile (clique na foto do header)

### Webhook da Evolution API
- [ ] Webhook configurado na instância via `setInstanceWebhook(instanceName, clinicId)`
- [ ] Eventos: `MESSAGES_UPSERT`, `CONTACTS_UPSERT`, `CONNECTION_UPDATE`
- [ ] URL: `{SUPABASE_URL}/functions/v1/evolution-webhook?clinicId={clinicId}`
- [ ] Reconectar a instância WhatsApp após deploy para disparar `CONTACTS_UPSERT`

---

## Variáveis de Ambiente Necessárias

### Supabase Edge Functions (secrets)
```
EVOLUTION_API_URL         URL base da Evolution API (sem barra final)
EVOLUTION_API_KEY         API key do painel Evolution
SUPABASE_URL              URL do projeto Supabase (automático)
SUPABASE_SERVICE_ROLE_KEY Service role key (automático)
```

### Frontend (`.env`)
```
VITE_SUPABASE_URL         URL do projeto Supabase
VITE_SUPABASE_ANON_KEY    Chave anônima pública do Supabase
```

