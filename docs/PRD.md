# PRD — DBE Flow (Marketing OS)

> **Product Requirements Document** do produto unificado da DBE.
> Versão 1.0 · 2026-05-25 · Idioma: pt-BR
> Documentos relacionados: [`AUDITORIA.md`](./AUDITORIA.md) · [`PLANO_IMPLEMENTACAO.md`](./PLANO_IMPLEMENTACAO.md)

---

## 1. Visão geral

**DBE Flow** é o **sistema operacional único da DBE** — uma assessoria de
marketing médico. Ele une, num só produto, tudo o que hoje está espalhado em 8
apps separados: comercial, diagnóstico, onboarding, contratos, criação de
conteúdo com IA, produção da equipe, publicação, aprovação do cliente,
relatórios de performance, conversas (WhatsApp) e financeiro.

**Frase-resumo:** *do primeiro contato do lead ao post publicado e ao boleto
pago — tudo num fluxo só, com a Deby (IA) como copiloto em cada etapa.*

### 1.1 Problema
A operação da DBE está fragmentada: o lead entra por um funil (dbe-diagnostico),
vira lead numa planilha (dbe-crm), o onboarding é outro app (dbe-onboarding), o
contrato é gerado em outro (dbe-contratos), o conteúdo é criado num SaaS
sofisticado (dbe-creator), a produção da equipe roda em outro (DBEX-MVP) e a
publicação/legenda em outro (Projeto-Post). Dados não conversam, há retrabalho,
chaves espalhadas e nenhuma visão única do negócio.

### 1.2 Solução
Um único app (DBE Flow) com backend real (Supabase, multi-workspace), onde cada
módulo é uma etapa do mesmo fluxo e os dados fluem automaticamente entre eles.

### 1.3 Objetivos do produto (Norte)
1. **Fluxo único, dado único:** um lead vira cliente, vira contrato, vira
   calendário de conteúdo, vira faturamento — sem recadastro.
2. **IA Deby em tudo:** ideia, roteiro, gancho, CTA, legenda, análise e insights.
3. **Cliente no loop:** aprovação de conteúdo e diagnóstico por link público.
4. **Operação previsível:** produção da equipe, prazos e financeiro sob controle.
5. **Seguro por padrão:** nenhuma chave no navegador; RLS por workspace.

---

## 2. Público e personas

| Persona | Quem é | Dores | O que faz no DBE Flow |
|---|---|---|---|
| **Dono/Gestor DBE** | Liderança da assessoria | Falta de visão única, decisões no escuro | Central executiva, financeiro, CRM, relatórios |
| **Comercial** | SDR/closer | Lead solto, follow-up perdido | Diagnóstico, CRM/kanban, contratos, conversas |
| **Estrategista/Deby** | Diretor de conteúdo | Conteúdo sem método | Mapa de mercado, pilares, ideias, roteiros + IA |
| **Editor/Produção** | Equipe criativa | Prazos, status, aprovações confusas | Produção de criativos, checklist, calendário |
| **Cliente (médico)** | Contratante | Quer acompanhar e aprovar fácil | Diagnóstico público, link de aprovação, relatório |

---

## 3. Princípios de produto
1. **Local-first → cloud-first sem fricção.** Funciona offline para uso imediato,
   mas o estado real vive no Supabase e sincroniza.
2. **Cada chave fica no servidor.** IA, Meta e WhatsApp passam por Edge/Netlify
   Functions. Nunca no front. (regra herdada do `dbe-creator/AGENTS.md`).
3. **Multi-workspace nativo.** Toda tabela tem `workspace_id` + RLS.
4. **Sem promessa de resultado.** Conteúdo médico segue conformidade (CFM):
   autoridade e método, nunca garantia de resultado.
5. **UI premium e consistente.** Tema escuro/claro, micro-interações, mobile.

---

## 4. Arquitetura de informação (módulos)

Navegação organizada por **etapa do fluxo**, não por app de origem:

```
COMERCIAL          CRIAÇÃO              PRODUÇÃO            RESULTADOS
─ Central (KPIs)   ─ Mapa de Mercado    ─ Calendário        ─ Relatórios
─ Diagnóstico      ─ Pilares            ─ Campanhas         ─ Financeiro
─ CRM / Pipeline   ─ Ideias             ─ Produção/Criativos
─ Onboarding       ─ Materiais          ─ Aprovações        PLATAFORMA
─ Contratos        ─ Roteiros           ─ Teleprompter      ─ Conversas (WhatsApp)
                   ─ Deby AI            ─ Instagram Studio  ─ Integrações
                                                            ─ Configurações/Equipe
```

**Fluxo central do negócio:**
`Diagnóstico → Lead (CRM) → Contrato → Onboarding → Mapa/Pilares → Ideia →
Roteiro → Deby (análise) → Aprovação do cliente → Calendário → Produção →
Publicação (Instagram) → Relatório → Financeiro` — com **Conversas** e **Deby
AI** disponíveis em qualquer ponto.

---

## 5. Requisitos funcionais por módulo

> Marcação: **[base]** já existe (maquete) no flow · **[creator]** portar do
> dbe-creator · **[novo]** trazer de app legado.

### 5.1 Central executiva **[base+creator]**
- KPIs: MRR, pipeline, contas a receber, posts em produção, leads quentes.
- Atalhos para ações recomendadas e visão por workspace.

### 5.2 Diagnóstico de posicionamento **[base + dbe-diagnostico]**
- Funil público multi-etapas com **calculadora + presets**, **salvar/retomar
  progresso**, **exit-intent**, **rastreamento de eventos**, **captura de UTM**.
- Geração de **laudo** (score, perda estimada, potencial) + compartilhar
  WhatsApp + **webhook que cria o lead no CRM** automaticamente.

### 5.3 CRM / Pipeline comercial **[base + dbe-crm]**
- Lead com modelo rico (25+ campos: origem, especialidade, temperatura, valor,
  notas, UTM…). Kanban (Novo→Contato→Reunião→Proposta→Contrato) + tabela.
- Stats comerciais. Ações: WhatsApp, copiar briefing, avançar etapa.

### 5.4 Onboarding / Raio-X clínico **[base + dbe-onboarding + creator wizard]**
- Briefing clínico estruturado → cria jornada de onboarding com checklist e
  progresso. Branding do workspace + guia de plataforma.

### 5.5 Contratos **[base + dbe-contratos]**
- Gerador a partir do **template oficial DBE (.docx/Google Docs)**, dados
  puxados do CRM, valor/parcelas/vencimento, geração de arquivo e armazenamento.

### 5.6 Mapa de Mercado **[creator]**
- Nicho, concorrentes, diferenciais, público, dor principal, tom de voz +
  **insights estratégicos gerados pela Deby**.

### 5.7 Pilares de conteúdo **[creator]**
- Pilares (autoridade, vendas, conexão…) que orientam ideias e roteiros.

### 5.8 Ideias **[creator]**
- Backlog → fazendo → feito, tags, **geração de ideias por IA** a partir do mapa.

### 5.9 Materiais **[creator]**
- Biblioteca de insumos (link/arquivo/áudio) vinculável a roteiros.

### 5.10 Roteiros **[base + creator]**
- Gancho/desenvolvimento/CTA, **histórico de versões**, **templates**, **editor
  rich-text**, **colaboração em tempo real (presence + field locking)**,
  **exportação PDF/DOCX**, **análise da Deby com score 0–10**.

### 5.11 Deby AI **[base→creator]**
- Substituir resposta estática pelas Edge Functions reais: gerar ideias,
  roteiro, gancho, otimizar CTA, analisar roteiro, analisar mapa, wizard de
  mapa, insights de relatório. Deby = **diretora de conteúdo crítica**, schema
  JSON definido (ver `dbe-creator/docs/AI_DEBY.md`).

### 5.12 Calendário editorial **[base + creator]**
- Agendamento por data/plataforma vinculado a roteiro e campanha.

### 5.13 Campanhas **[creator]**
- Planejamento (planning/active/completed/paused) + checklist + metas.

### 5.14 Produção de criativos **[novo — DBEX-MVP]**
- Pipeline da equipe: projeto → criativo, status (revisão/aprovado/postado),
  **status de capa**, **prazo com alerta de atraso**, prioridade, tags,
  **responsável + editor**, **checklist**, **comentários**, **histórico**,
  **assets**. **Importação do Notion**. Stats por projeto e global.

### 5.15 Aprovações **[base + creator + Projeto-Post]**
- Link público (single + **lote**), **comentários por seção**, token +
  expiração, status (pendente/aprovado/ajustes). Notifica no app e por WhatsApp.

### 5.16 Teleprompter **[base ✅]**
- Já funcional (fonte, velocidade, espelho, modo foco) + atalhos de teclado.

### 5.17 Instagram Studio **[base + creator + Projeto-Post]**
- Esteira de conteúdo + **OAuth Meta**, contas/páginas, **insights**, **sync de
  métricas** e **publicação real via Graph API** + **geração de legenda por IA**.

### 5.18 Relatórios **[creator]**
- Insights do Instagram + **insights de IA** por cliente/campanha.

### 5.19 Conversas / WhatsApp **[base + Projeto-Post skills]**
- **Evolution API**: webhook de entrada, **fila** com idempotência, inbox de
  conversas, upsert de contato/conversa, templates, sync de status. Aciona
  aprovações, cobranças e follow-ups comerciais.

### 5.20 Financeiro **[base + novo]**
- Cobranças, MRR, a receber, inadimplência. Evoluir para **recorrência** e
  **PIX/gateway (Asaas/Stripe)**, vínculo **contrato → fatura**.

### 5.21 Integrações & Configurações **[base + creator]**
- Status e conexão de Supabase, IA, Meta, Evolution, Google, Netlify. Gestão de
  **equipe/roles**, tema, branding, **PWA/mobile**.

---

## 6. Requisitos não-funcionais
- **Segurança:** RLS por workspace; chaves só no servidor; tokens de aprovação
  únicos com expiração; auditoria de ações (histórico).
- **Performance:** cache com TanStack Query (`staleTime`); índices em
  `workspace_id`/`user_id`; lazy-loading de páginas.
- **Disponibilidade:** deploy Netlify + Supabase; funções serverless.
- **Conformidade:** marketing médico sem promessa de resultado (CFM); LGPD nos
  dados de leads/pacientes.
- **Acessibilidade & UX:** responsivo, mobile bottom-nav, tema claro/escuro.
- **Observabilidade:** logs de Edge Functions; eventos de funil; erros.

---

## 7. Modelo de dados (alto nível)
Base no schema do `dbe-creator` (ver `dbe-creator/docs/DATABASE_SCHEMA.md`),
estendido com as entidades dos apps legados:

- **Núcleo:** `profiles`, `workspaces`, `workspace_members`.
- **Comercial:** `leads` (CRM rico), `diagnostics`, `contracts`, `invoices`,
  `onboarding_journeys`.
- **Estratégia/criação:** `market_maps`, `content_pillars`, `ideas`,
  `materials`, `scripts`, `script_versions`, `script_templates`, `ai_analyses`.
- **Produção:** `projects`, `creatives`, `creative_checklist`,
  `creative_comments`, `creative_history`, `creative_assets`, `team_members`,
  `campaigns`, `calendar_items`.
- **Distribuição:** `approvals`, `approval_comments`, `instagram_accounts`,
  `instagram_metrics`, `meta_oauth_states`.
- **Comunicação:** `conversations`, `contacts`, `messages`, `automations`.

Todas com `workspace_id` + RLS: `auth.uid() IN (SELECT user_id FROM
workspace_members WHERE workspace_id = table.workspace_id)`.

---

## 8. Métricas de sucesso (KPIs do produto)
- **Ativação:** % de workspaces que completam mapa+pilares+1º roteiro em 7 dias.
- **Fluxo comercial:** tempo médio diagnóstico → contrato assinado.
- **Conteúdo:** roteiros/mês por workspace; % aprovados de primeira; score médio
  Deby.
- **Distribuição:** posts publicados/mês; tempo médio até aprovação do cliente.
- **Financeiro:** MRR gerido; inadimplência; taxa de renovação.
- **Adoção de IA:** % de roteiros que usaram a Deby.

---

## 9. Escopo por fase (resumo — detalhe no plano)
- **MVP unificado (F1–F2):** fundação (auth, workspace, Supabase) + portar o que
  o creator já tem real + CRM/diagnóstico/contratos do legado.
- **V1 (F3–F6):** IA Deby completa, Instagram (insights+publicação), aprovações,
  módulos estratégicos, produção de criativos.
- **V2 (F7–F10):** Conversas/WhatsApp, financeiro com pagamentos, diagnóstico
  premium, PWA/mobile, deploy e polimento.

## 10. Fora de escopo (por enquanto)
- App nativo iOS/Android (será PWA primeiro).
- Marketplace de templates entre workspaces.
- BI avançado/data warehouse (relatórios nativos primeiro).

## 11. Questões em aberto (decidir antes de codar)
1. **Estratégia de base de código:** evoluir o `dbe-flow` portando o backend do
   `dbe-creator`, **ou** adotar o `dbe-creator` como base e migrar a UI/visão do
   flow? (recomendação no plano: usar o creator como motor).
2. **Backend único:** confirmar **Supabase** como padrão e aposentar Apps
   Script/Sheets (mantendo só o gerador de `.docx` se necessário).
3. **Provedor de IA:** OpenRouter (creator) vs. Anthropic (Post) — padronizar.
4. **WhatsApp:** Evolution self-hosted vs. Z-API vs. Meta Cloud.
5. **Pagamentos:** Asaas (PIX/boleto BR) vs. Stripe.
