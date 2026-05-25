# Auditoria do Ecossistema DBE → DBE Flow

> Documento de auditoria técnica de **todos os apps DBE** e mapa de lacunas para
> transformar o **DBE Flow** no app mais completo, unindo todas as funções.
>
> Data: 2026-05-25 · Autor: Auditoria técnica DBE

---

## 1. Inventário dos apps existentes

A pasta `juntar apps DBE/` contém **8 aplicações** em estágios muito diferentes.
Resumo do que cada uma é e do que ela tem de **real** (funciona de verdade) vs.
**maquete** (só interface, sem backend).

| App | Stack | Estado | Papel no negócio |
|-----|-------|--------|------------------|
| **dbe-flow** | React 19 + Vite (1 arquivo) | Maquete local-first (localStorage) | O "guarda-chuva" — junta tudo numa UI só, mas sem backend |
| **dbe-creator** | React + TS + Vite + Supabase + Netlify | **Produção real** (SaaS completo) | Sistema operacional de conteúdo (Ideia→Roteiro→IA→Calendário→Performance) |
| **DBEX - MVP** | Vanilla JS + Supabase | **Real** | Gestão de produção de criativos da equipe (kanban interno) |
| **dbe-notion** | Vanilla JS (cópia do DBEX) | Clone/patch do DBEX | Mesmo do DBEX (importação Notion) |
| **Projeto-Post** | Google Apps Script + Sheets/Drive/Meta | **Real (legado)** | Agendamento/publicação de posts + revisão + IA legenda |
| **dbe-contratos** | Apps Script + Netlify Function + .docx | **Real (legado)** | Geração de contratos oficiais DBE |
| **dbe-crm** | Apps Script + HTML | **Real (legado)** | CRM de leads do diagnóstico (Sheets) |
| **dbe-diagnostico** | HTML único sofisticado | **Real (legado)** | Funil público de diagnóstico de posicionamento |
| **dbe-onboarding** | HTML + Apps Script | **Real (legado)** | Raio-X clínico → CRM médico (briefing/onboarding) |

> **Conclusão-chave:** o **dbe-creator** já é, de longe, o app mais avançado e o
> único com backend de produção sólido (Supabase + RLS multi-workspace + Edge
> Functions + Meta OAuth). O **dbe-flow** tem a melhor *visão de produto*
> (13 módulos num painel só), mas tudo é maquete. **A estratégia vencedora é
> fundir o backend real do dbe-creator dentro da visão unificada do dbe-flow**,
> e trazer as funções únicas dos apps legados.

---

## 2. Auditoria detalhada por app

### 2.1 dbe-flow (alvo) — `src/main.jsx` (1.265 linhas)
- **Stack:** React 19, Vite 8, lucide-react, date-fns. Um único arquivo.
- **Persistência:** `localStorage` (`dbe-flow-state-v1`). Sem auth, sem banco.
- **13 módulos (todos maquete):** Central/Dashboard, Clientes (dossiê), CRM
  (kanban + pipeline), Diagnóstico (+ página pública), Onboarding, Contratos
  (gera `.txt`), Roteiros, Teleprompter, Deby AI (texto estático), Instagram
  Studio (kanban local), Conversas (templates + link wa.me), Financeiro,
  Integrações (checklist).
- **O que já é bom:** a UI/UX e a *amplitude* de módulos. Já tem os "encaixes"
  certos (export workspace, links públicos simulados, score de diagnóstico).
- **O que falta (tudo que importa):** backend real, auth, multi-workspace,
  IA real, integrações reais. Ver seção 4.

### 2.2 dbe-creator — o motor real
- **Stack:** React + **TypeScript** + Vite + Tailwind + shadcn/ui + Framer
  Motion + TanStack Query + React Hook Form + Zod + React Router. Arquitetura
  **feature-based** (`src/features/*`).
- **Backend Supabase:** Auth, PostgreSQL, **RLS multi-workspace**, Storage,
  **Edge Functions** (IA), **~30 migrations** versionadas.
- **Netlify Functions:** Meta OAuth (authorize/callback/disconnect/pages/
  accounts/insights), aprovações públicas (single + batch).
- **Módulos reais:**
  - **Auth completo:** login, registro, confirmação de e-mail, route guards.
  - **Workspaces** (multi-tenant) com contexto e troca de workspace.
  - **Ideias** (backlog → doing → done, tags) + geração por IA.
  - **Materiais** (link/arquivo/áudio — biblioteca de insumos).
  - **Mapa de Mercado** (nicho, concorrentes, diferenciais, público, dor, tom
    de voz) + **insights estratégicos por IA**.
  - **Pilares de conteúdo** (autoridade, vendas, conexão…).
  - **Roteiros** com: **histórico de versões**, **templates**, **editor
    rich-text (Quill)**, **colaboração em tempo real (presence)**, **field
    locking**, **exportação PDF/DOCX** (jspdf/docx/html2canvas), **análise da
    IA com score 0–10**.
  - **Deby AI (real, via Edge Functions + OpenRouter):** `analyze-script`,
    `analyze-market-map`, `market-map-wizard`, `deby-generate-ideas`,
    `deby-generate-script`, `deby-optimize-cta`, `deby-suggest-hook`,
    `deby-report-insights`.
  - **Calendário editorial** (publish_date, plataforma, notas).
  - **Campanhas** (planning/active/completed/paused + checklist).
  - **Aprovações** (link público, **lote/batch**, **comentários**, token +
    expiração).
  - **Teleprompter** (reader + atalhos de teclado).
  - **Relatórios** (insights do Instagram + insights de IA).
  - **Instagram/Meta:** OAuth, páginas, contas, **insights**, **sync de
    métricas** (Edge Function `sync-instagram-metrics`).
  - **Onboarding wizard** + branding do workspace + guia de plataforma.
  - **Configurações/Integrações.**
- **Docs maduros:** PRD, ARCHITECTURE, DATABASE_SCHEMA, ROADMAP, AI_DEBY,
  DESIGN_SYSTEM, plano de implementação.
- **O que NÃO tem (por decisão do MVP):** **publicação automática no
  Instagram** (adiada), **pagamentos**, CRM comercial, contratos, diagnóstico
  comercial, financeiro, conversas/WhatsApp. → Tudo isso vem dos outros apps.

### 2.3 DBEX - MVP / dbe-notion — gestão de produção
- **Stack:** Vanilla JS + Supabase (CDN), arquivo `app.js` com **4.083 linhas**.
- **Modelo:** `usuarios` (equipe com role/cor/iniciais), `clientes`, `projetos`,
  `criativos`.
- **Funções únicas (não existem no flow nem no creator):**
  - **Pipeline de produção de criativos** com workflow de status
    (revisão → aprovado → postado), **status de capa** (falta capa), **prazo
    com detecção de atraso**, **prioridade**, **tags**.
  - **Atribuição de responsável e editor** por criativo.
  - **Checklist** por criativo + **comentários** + **histórico/auditoria** +
    **assets** anexados.
  - **Estatísticas por projeto e globais** (ativos, em revisão, aprovados,
    postados, falta capa, atrasados, sem responsável).
  - **Importação do Notion** (`notion-import.js`): parser que transforma export
    do Notion em projetos/criativos (mapeia meses, responsáveis, limpa URLs).
  - **Tema claro/escuro** persistido.
- ⚠️ **Risco de segurança:** `supabase-config.js` tem **ANON key commitada** em
  texto — migrar para `.env` ao unificar.

### 2.4 Projeto-Post — agendamento/publicação + IA
- **Stack:** Google Apps Script (Sheets + Drive + **Meta Graph API** +
  **Anthropic**). `backend.gs` + `backend2.gs`.
- **Funções únicas:**
  - **`publishToMeta(postId)`** — **publicação real no Instagram** via Graph API
    (o creator adiou isso!).
  - **`generateIACaption(payload)`** — geração de legenda por IA (Anthropic).
  - **Fluxo de revisão por token** público (aprovar/reprovar/comentar) com
    `getPostByRevisionToken`, `handleRevision`.
  - **Integração Google Drive** (`getDriveFiles`) — puxa criativos do Drive.
  - **Dashboard, Clientes, Posts, Log** em Sheets.
- **Skills documentadas** (`.agent/skills/`): **whatsapp-integration**
  (Evolution API / Z-API / Meta Cloud, webhooks, fila BullMQ, idempotência,
  upsert de contato/conversa), auth-billing, backend-api, database-schema,
  deploy, frontend-dashboard. → Estes são o blueprint do módulo **Conversas**.

### 2.5 dbe-contratos — contratos oficiais
- **Stack:** Apps Script `doPost` + **Netlify Function** `gerar-contrato.js` +
  template **`.docx` oficial** + HTML.
- **Função única:** geração de **contrato oficial DBE** (Google Docs/Drive),
  com a minuta jurídica real da empresa (vs. o `.txt` simplificado do flow).

### 2.6 dbe-crm — CRM de leads (Sheets)
- **Stack:** Apps Script + HTML.
- **Funções:** `saveLead`, `getLeads`, `updateLead`, `deleteLead`, `getStats`
  numa planilha "Leads" com **25+ colunas** (perfil comercial completo do lead).
- **Valor:** modelo de dados de CRM mais rico que o do flow.

### 2.7 dbe-diagnostico — funil público premium
- **Stack:** HTML único, muito polido (51 referências a score/etapas).
- **Funções únicas (superiores ao flow):** questionário multi-etapas
  (`renderQuestion`, `selectAnswer`), **cálculo de score + laudo** (`goLaudo`,
  `goCalc`), **calculadora com presets** (`applyPreset`, `updateCalc`),
  **salvar/retomar progresso** (`saveProgress`/`loadProgress`),
  **exit-intent popup** (`showExitPopup`), **rastreamento de eventos**
  (`trackEvent`), **compartilhar no WhatsApp** (`shareWhatsApp`), **webhook para
  CRM** (`sendWebhook`), captura de UTM (`getUrlParam`).

### 2.8 dbe-onboarding — Raio-X clínico → CRM
- **Stack:** `app1-briefing/briefing.html` (Raio-X Clínico), `app2-crm/crm2.html`
  (painel CRM médico), `suite.html`, backend Apps Script (Sheets).
- **Função única:** fluxo de **briefing/onboarding clínico** estruturado que
  alimenta o CRM — modelo de onboarding mais profundo que o do flow.

---

## 3. Matriz de capacidades (quem tem o quê)

Legenda: ✅ real · 🟡 maquete/parcial · ➖ não tem

| Capacidade | flow | creator | DBEX | Post | contratos | crm | diag | onboard |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Auth + multi-workspace (RLS) | ➖ | ✅ | 🟡 | ➖ | ➖ | ➖ | ➖ | ➖ |
| Banco real persistido | ➖ | ✅ | ✅ | ✅(Sheets) | ✅(Sheets) | ✅(Sheets) | ➖ | ✅(Sheets) |
| Dashboard/KPIs | 🟡 | ✅ | ✅ | ✅ | ➖ | 🟡 | ➖ | ➖ |
| CRM comercial | 🟡 | ➖ | ➖ | ➖ | ➖ | ✅ | ➖ | 🟡 |
| Diagnóstico/funil público | 🟡 | ➖ | ➖ | ➖ | ➖ | 🟡 | ✅ | ✅ |
| Onboarding/briefing | 🟡 | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ |
| Ideias / Materiais | ➖ | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| Mapa de Mercado / Pilares | ➖ | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| Roteiros (versões/templates/RT) | 🟡 | ✅ | 🟡 | ➖ | ➖ | ➖ | ➖ | ➖ |
| IA Deby real | 🟡 | ✅ | ➖ | ✅(legenda) | ➖ | ➖ | ➖ | ➖ |
| Calendário editorial | 🟡 | ✅ | 🟡 | ✅ | ➖ | ➖ | ➖ | ➖ |
| Campanhas | ➖ | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| Aprovações (link público/lote) | 🟡 | ✅ | 🟡 | ✅ | ➖ | ➖ | ➖ | ➖ |
| Teleprompter | ✅ | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| Instagram insights/sync | ➖ | ✅ | ➖ | 🟡 | ➖ | ➖ | ➖ | ➖ |
| **Publicação no Instagram** | ➖ | ➖ | ➖ | ✅ | ➖ | ➖ | ➖ | ➖ |
| Relatórios/performance | ➖ | ✅ | ➖ | 🟡 | ➖ | ✅(stats) | ➖ | ➖ |
| Gestão de produção (criativos) | ➖ | ➖ | ✅ | 🟡 | ➖ | ➖ | ➖ | ➖ |
| Equipe/responsáveis/checklist | ➖ | 🟡 | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ |
| Importação Notion | ➖ | ➖ | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ |
| Conversas/WhatsApp (Evolution) | 🟡 | ➖ | ➖ | ✅(doc) | ➖ | ➖ | ➖ | ➖ |
| Contratos oficiais (Docs/.docx) | 🟡 | ➖ | ➖ | ➖ | ✅ | ➖ | ➖ | ➖ |
| Financeiro/cobranças | 🟡 | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| Tema claro/escuro + PWA/mobile | ➖ | ✅ | ✅(tema) | ➖ | ➖ | ➖ | ➖ | ➖ |

---

## 4. O que falta no dbe-flow para ser o app mais completo

Agrupado por bloco. Cada item indica a **origem** (de onde trazer a função real).

### Bloco A — Fundação (de: dbe-creator)
1. **Migrar para TypeScript + arquitetura feature-based** (sair do arquivo único).
2. **Auth real** (Supabase): login, registro, confirmação, route guards.
3. **Multi-workspace + RLS** (todo dado com `workspace_id`).
4. **Persistência real** (Postgres) substituindo `localStorage` — com camada de
   migração do estado local atual.
5. **Infra de dados:** TanStack Query, React Hook Form + Zod, React Router.
6. **Edge Functions + Netlify Functions** (segurança: nenhuma chave no browser).

### Bloco B — IA Deby real (de: dbe-creator + Projeto-Post)
7. Substituir `buildAiOutput` estático pelas **8 Edge Functions** do creator
   (ideias, roteiro, gancho, CTA, análise de roteiro, análise de mapa, wizard de
   mapa, insights de relatório).
8. Trazer **geração de legenda por IA** do Projeto-Post para o Instagram Studio.

### Bloco C — Estratégia & criação (de: dbe-creator)
9. **Mapa de Mercado** (+ insights IA). 10. **Pilares de conteúdo.**
11. **Central de Ideias.** 12. **Biblioteca de Materiais.**
13. **Roteiros avançados:** versões, templates, editor rich-text, colaboração
    em tempo real, field locking, exportação PDF/DOCX, score de análise.
14. **Campanhas** (com checklist). 15. **Calendário editorial real.**

### Bloco D — Distribuição & performance (de: dbe-creator + Projeto-Post)
16. **Instagram/Meta:** OAuth + páginas + contas + **insights** + **sync**.
17. **Publicação real no Instagram** (Graph API) — função do Projeto-Post.
18. **Aprovações:** páginas públicas, **lote**, **comentários**, token+expiração.
19. **Relatórios** de performance (insights + IA).

### Bloco E — Operação da agência (de: DBEX-MVP)
20. **Gestão de produção de criativos** (pipeline com status/capa/prazo).
21. **Equipe** (usuários, roles, responsável/editor), **checklist**,
    **comentários**, **histórico/auditoria**, **assets**.
22. **Importação do Notion.**

### Bloco F — Comercial & jurídico & financeiro (de: crm, diagnostico, onboarding, contratos)
23. **CRM comercial rico** (modelo de lead com 25+ campos, stats) — do dbe-crm.
24. **Diagnóstico premium** (funil com calculadora, presets, salvar progresso,
    exit-intent, tracking, webhook, UTM) — do dbe-diagnostico.
25. **Onboarding/briefing clínico** estruturado — do dbe-onboarding.
26. **Contratos oficiais** via Google Docs/.docx — do dbe-contratos.
27. **Financeiro** evoluído: cobranças recorrentes, **PIX/gateway (Asaas/
    Stripe)**, vínculo contrato→fatura.

### Bloco G — Comunicação (de: Projeto-Post skills)
28. **Conversas/WhatsApp real:** Evolution API, webhooks de entrada, fila,
    idempotência, inbox de conversas, sync de status.

### Bloco H — Plataforma (de: dbe-creator + DBEX)
29. **Tema claro/escuro**, **PWA**, **navegação mobile (bottom-nav)**,
    **notificações**.
30. **Deploy** Netlify com variáveis de ambiente e domínio.

---

## 5. Riscos e dívidas técnicas a resolver na unificação
- 🔴 **Chaves expostas:** `DBEX/js/supabase-config.js` e arquivos `credenciais.*`
  na raiz. Tudo deve ir para `.env`/cofre do Supabase e sair do versionamento.
- 🟠 **Duas fontes de backend:** Supabase (creator/DBEX) vs. Apps Script/Sheets
  (Post/crm/contratos/onboarding). Decisão: **padronizar em Supabase** e tratar
  Apps Script como integrações de saída quando necessário (ex.: gerar `.docx`).
- 🟠 **Arquivo único de 1.265 linhas** no flow não escala — refatorar para
  features antes de crescer.
- 🟡 **Modelos de dados divergentes** (snake_case no Supabase, camelCase no
  front) — já há mapeadores no DBEX/creator a reaproveitar.

> **Próximos documentos:** ver `PRD.md` (o produto unificado) e
> `PLANO_IMPLEMENTACAO.md` (as fases de execução).
