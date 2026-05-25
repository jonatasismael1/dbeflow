# Plano de Implementação — DBE Flow unificado

> Como transformar o DBE Flow no app mais completo, unindo todas as funções dos
> 8 apps. Versão 1.0 · 2026-05-25.
> Ver também: [`AUDITORIA.md`](./AUDITORIA.md) · [`PRD.md`](./PRD.md)

---

## 0. Decisão estratégica (a tomar primeiro)

A maior alavanca de tempo é **não reescrever o que já existe**. O `dbe-creator`
já é um SaaS de produção (Supabase + RLS + Edge Functions + Meta OAuth + IA +
roteiros avançados). O `dbe-flow` tem a melhor **visão de produto** (13 módulos
num painel), mas é maquete.

**Recomendação: usar o `dbe-creator` como MOTOR (base de código) e trazer para
dentro dele a visão unificada e os módulos comerciais do flow + funções dos
legados.** Renomear o produto para **DBE Flow**.

> Por quê: portar Supabase/RLS/Edge/Meta/IA do creator para o flow do zero
> custaria semanas e reintroduziria bugs já resolvidos. Trazer 5–6 módulos novos
> para dentro do creator (arquitetura feature-based) é incremental e seguro.

**Alternativa** (se quiser manter o flow como base por algum motivo de
branding/código): seguir as mesmas fases, mas a Fase 1 vira "portar a fundação
do creator", o que adiciona ~2–3 semanas. As fases abaixo servem para os dois
caminhos; onde diferem, está sinalizado.

---

## 1. Pré-requisitos (Fase 0 — 1 a 2 dias)
- [ ] **Higiene de segurança:** remover `credenciais.*`, `credenciais-vibe-*.json`
      e a ANON key de `DBEX/js/supabase-config.js` do versionamento. Rotacionar
      chaves expostas. Mover tudo para `.env` / cofre do Supabase.
- [ ] **Consolidar repositório:** um repo único (monorepo simples) com o app
      escolhido como base; legados viram pasta `/legacy` de referência.
- [ ] **Confirmar decisões em aberto** do PRD §11 (base de código, backend único,
      IA, WhatsApp, pagamentos).
- [ ] **Provisionar:** projeto Supabase (já existe no creator), site Netlify,
      contas Meta (app), OpenRouter, Evolution, Google service account.

---

## Fase 1 — Fundação unificada (semana 1–2)
**Meta:** uma base só, logada, multi-workspace, com a navegação completa do PRD.
- [ ] Adotar a base (creator) e renomear para DBE Flow (branding, logo, título).
- [ ] Migrar a **navegação** para a IA do PRD (4 grupos: Comercial, Criação,
      Produção, Resultados + Plataforma).
- [ ] Confirmar **Auth + workspaces + RLS** funcionando (já existe no creator).
- [ ] **Camada de migração local→cloud:** importar o estado `localStorage` do
      flow (`dbe-flow-state-v1`) para as tabelas Supabase (script único).
- [ ] Tema claro/escuro + layout mobile (bottom-nav) — já existe no creator.

**Entregável:** app único, logado, com todos os itens de menu (alguns ainda
placeholder), dados reais por workspace.

---

## Fase 2 — Comercial: trazer o legado para o motor (semana 3–4)
**Meta:** o fluxo de entrada de receita dentro do app.
- [ ] **CRM rico** (de `dbe-crm`): tabela `leads` com 25+ campos, kanban +
      tabela + stats. Migrations + serviço + UI feature `crm/`.
- [ ] **Diagnóstico** (de `dbe-diagnostico`): funil público premium (calculadora,
      presets, salvar/retomar, exit-intent, tracking, UTM) → **webhook cria lead**.
- [ ] **Onboarding/briefing** (de `dbe-onboarding`): jornada com checklist.
- [ ] **Contratos** (de `dbe-contratos`): integrar Netlify Function +
      template `.docx`/Google Docs; puxar dados do lead/cliente.
- [ ] **Financeiro** (do flow): tabela `invoices`, cobranças, MRR/a receber.

**Entregável:** Diagnóstico → Lead → Contrato → Onboarding → Fatura, ponta a
ponta, com dados reais.

---

## Fase 3 — IA Deby completa (semana 5)
**Meta:** IA real em todos os pontos (já 80% pronta no creator).
- [ ] Validar/ligar as 8 Edge Functions: `deby-generate-ideas`,
      `deby-generate-script`, `deby-suggest-hook`, `deby-optimize-cta`,
      `analyze-script`, `analyze-market-map`, `market-map-wizard`,
      `deby-report-insights`.
- [ ] Trocar a **Deby AI maquete** do flow pelas chamadas reais.
- [ ] Padronizar provedor (OpenRouter) e o schema JSON da Deby (`AI_DEBY.md`).
- [ ] Portar **geração de legenda por IA** do Projeto-Post para o Instagram.

**Entregável:** Deby gera ideia, roteiro, gancho, CTA, legenda e analisa com
score — tudo via servidor (zero chave no front).

---

## Fase 4 — Criação & estratégia (semana 6) — já existe no creator
**Meta:** confirmar e integrar os módulos do creator à navegação do flow.
- [ ] Mapa de Mercado (+ insights IA), Pilares, Ideias, Materiais.
- [ ] Roteiros avançados: versões, templates, rich-text, **colaboração
      realtime + field locking**, exportação PDF/DOCX, score.
- [ ] Campanhas + Calendário editorial.

**Entregável:** pipeline de criação completo Ideia→Roteiro→Calendário.

---

## Fase 5 — Distribuição & performance (semana 7–8)
**Meta:** publicar e medir.
- [ ] **Instagram/Meta:** OAuth + páginas + contas + **insights** + **sync**
      (já existe no creator).
- [ ] **Publicação real** no Instagram via Graph API (portar `publishToMeta` do
      Projeto-Post) — recurso que o creator havia adiado.
- [ ] **Aprovações:** páginas públicas single + **lote** + **comentários** +
      token/expiração (já existe no creator) + acionamento por WhatsApp.
- [ ] **Relatórios** de performance (insights + IA).

**Entregável:** roteiro aprovado → agendado → publicado → relatório.

---

## Fase 6 — Operação da agência (semana 9–10) — de DBEX-MVP
**Meta:** a equipe roda a produção dentro do app.
- [ ] Modelar `projects`, `creatives`, `creative_checklist`,
      `creative_comments`, `creative_history`, `creative_assets`, `team_members`.
- [ ] UI de **pipeline de produção** (status/capa/prazo/prioridade/tags,
      responsável+editor, checklist, comentários, histórico, assets, stats).
- [ ] **Importação do Notion** (portar `notion-import.js`).
- [ ] Gestão de **equipe e roles**.

**Entregável:** produção da equipe com prazos e auditoria, integrada ao
calendário e às aprovações.

---

## Fase 7 — Conversas / WhatsApp (semana 11–12)
**Meta:** comunicação real, não só link wa.me.
- [ ] Integrar **Evolution API**: instância, QR/conexão, webhook de entrada.
- [ ] **Fila** (idempotência por `external_id`), upsert contato/conversa,
      insert mensagem, atualizar `last_message_at`/preview.
- [ ] **Inbox** de conversas no app + templates + sync de status.
- [ ] **Automações:** lead quente, aprovação de post, cobrança amigável.

**Entregável:** caixa de entrada WhatsApp funcional ligada a CRM/aprovações/
financeiro.

---

## Fase 8 — Financeiro com pagamentos (semana 13)
**Meta:** cobrança previsível.
- [ ] Recorrência de cobranças vinculada a contratos.
- [ ] Gateway **PIX/boleto (Asaas)** ou **Stripe**; conciliação de status.
- [ ] Régua de cobrança via Conversas.

**Entregável:** contrato → faturas recorrentes → cobrança automática.

---

## Fase 9 — Diagnóstico premium público (semana 14)
**Meta:** funil de captação de alta conversão.
- [ ] Portar 100% do `dbe-diagnostico` (UX, presets, calculadora, exit-intent,
      tracking, UTM, salvar/retomar) como página pública do workspace.
- [ ] A/B do laudo e webhook robusto para o CRM.

**Entregável:** link público de diagnóstico premium por workspace.

---

## Fase 10 — Plataforma, polimento e deploy (semana 15–16)
- [ ] **PWA** (instalável) + revisão mobile.
- [ ] Notificações (in-app + push/WhatsApp).
- [ ] Observabilidade: logs de funções, eventos de funil, monitoramento de erros.
- [ ] **Deploy** Netlify (build + env vars + domínio) + Supabase produção.
- [ ] QA end-to-end do fluxo central completo.

**Entregável:** DBE Flow em produção, unificando os 8 apps.

---

## Mapa "de onde vem cada função" (rastreabilidade)

| Módulo no DBE Flow | Origem real | Tipo de trabalho |
|---|---|---|
| Auth, workspace, RLS, Edge Functions | dbe-creator | reusar |
| Ideias, Materiais, Mapa, Pilares | dbe-creator | reusar |
| Roteiros (versões/templates/realtime/export) | dbe-creator | reusar |
| Deby AI (8 funções) | dbe-creator | reusar |
| Calendário, Campanhas, Aprovações | dbe-creator | reusar |
| Instagram insights/sync | dbe-creator | reusar |
| **Publicação Instagram + legenda IA** | Projeto-Post | portar |
| **Conversas/WhatsApp (Evolution+fila)** | Projeto-Post (skills) | construir c/ blueprint |
| **Produção de criativos + Notion import** | DBEX-MVP | portar |
| **CRM rico (25+ campos)** | dbe-crm | portar |
| **Diagnóstico premium** | dbe-diagnostico | portar |
| **Onboarding/briefing clínico** | dbe-onboarding | portar |
| **Contratos oficiais (.docx/Docs)** | dbe-contratos | portar |
| Central, Teleprompter, Financeiro base | dbe-flow | manter/evoluir |

---

## Esforço estimado
- **MVP unificado (F0–F2):** ~4 semanas → já entrega valor real (comercial + IA).
- **V1 (F3–F6):** +6 semanas → produto completo de criação/produção/distribuição.
- **V2 (F7–F10):** +6 semanas → comunicação, pagamentos, funil premium, produção.
- **Total:** ~16 semanas para o produto completo (1 dev focado; menos com squad).

## Riscos principais
1. **Vazamento de chaves** já versionadas → rotacionar antes de tudo.
2. **Migração de dados** dos legados (Sheets) → scripts de import idempotentes.
3. **Limites de API** (Meta/WhatsApp) → respeitar rate limits e usar fila.
4. **Escopo** → seguir as fases; não pular para WhatsApp/pagamentos antes da
   fundação (regra herdada do `AGENTS.md` do creator).

## Quick wins (primeiros 3 dias, alto impacto)
1. Higiene de segurança (remover/rotacionar chaves).
2. Decidir base de código (recomendado: creator como motor).
3. Trocar a Deby AI maquete do flow pelas Edge Functions reais (efeito "uau"
   imediato).
4. Ligar o webhook do diagnóstico → criação de lead no CRM real.
