# Auditoria Completa do DBE Flow

## 1. Resumo executivo

O DBE Flow tem uma boa visão de produto para agência: concentra CRM, clientes, conteúdo, calendário, produção, WhatsApp, Instagram, contratos, financeiro, IA e integrações em uma interface única. Como produto para uso diário real, porém, ainda está em maturidade intermediária/experimental. Ele compila, tem muitos fluxos navegáveis e algumas integrações serverless reais, mas ainda não está pronto para operar como SaaS interno confiável sem correções críticas de segurança, dados, permissões e fluxo.

O principal risco não é falta de telas; é a diferença entre "tela existente" e "operação segura e rastreável". Hoje há autenticação local com senha compartilhada no front, RLS permissiva em quase todas as tabelas de negócio, ausência de workspace/permissões reais, armazenamento de dados sensíveis de cliente em JSONB acessível pelo anon key, ausência de histórico de alterações e modais/formulários sem proteção contra perda de dados. Também há um risco técnico concreto: `src/lib/db.js` usa tabelas `dbe_clients`, `dbe_scripts`, etc., enquanto as migrations versionadas criam `clients`, `scripts`, etc. Isso pode fazer a persistência principal falhar dependendo do banco aplicado.

O sistema pode servir como protótipo operacional controlado para a própria equipe se poucos usuários tiverem acesso e se os dados sensíveis forem removidos. Para rotina real de agência, a prioridade deve ser: autenticação real, RLS por usuário/workspace, correção do schema, fluxo de conteúdo com responsáveis/prazos/aprovação/comentários, e modais seguros para ações destrutivas.

Notas:

| Critério | Nota |
|---|---:|
| Funcionalidades | 6/10 |
| Fluxo de uso | 5/10 |
| UX | 5/10 |
| UI | 7/10 |
| Responsividade | 6/10 |
| Segurança | 2/10 |
| Organização técnica | 3/10 |
| Prontidão para uso por agência | 4/10 |

Base da análise: `src/main.jsx`, `src/styles.css`, `src/lib/*`, `netlify/functions/*`, `supabase/migrations/*`, `README.md` e `docs/*`. O build foi executado com sucesso (`npm run build`), com alerta de bundle grande.

## 2. Diagnóstico geral

### Pontos fortes

- A navegação cobre as principais áreas de uma agência: dashboard, cronograma, calendário, clientes, conversas, Instagram, produção, financeiro, CRM, onboarding, diagnóstico, IA, contratos e configurações.
- O Cronograma de Conteúdo é a área mais alinhada ao uso real: filtros por cliente/formato/status/responsável/mês/prioridade, modal de criação/edição, datas e vínculo com Drive para roteiros de Reels.
- Produção de vídeo tem integração prática com Google Drive: pasta por cliente, projetos, upload de brutos/finais e status de projeto.
- Instagram Analytics usa tabelas próprias com RLS fechada para anon/authenticated e acesso via Functions, que é um desenho melhor que o restante do banco.
- Há feedback por toast em criações/edições/exclusões e estados básicos de loading em financeiro, Instagram e produção.
- O layout visual é mais polido que uma maquete simples: sidebar, cards, badges, tema claro/escuro, bottom nav mobile e calendário semanal/mensal.

### Pontos fracos

- O app é praticamente monolítico: `src/main.jsx` tem cerca de 4.836 linhas e concentra UI, lógica de negócio, autenticação, finanças, integrações e helpers.
- Autenticação é local e frágil: usuários fixos, senha compartilhada no código e membros salvos em `localStorage`.
- Papéis existem só na UI. Admin/editor controlam abas visíveis, mas não há autorização real no banco para clientes, conteúdos, financeiro, WhatsApp ou Drive.
- Tabelas principais usam JSONB genérico, sem modelagem clara para tarefas, aprovações, comentários, versões, responsáveis, anexos e histórico.
- Faltam confirmação e recuperação em várias ações críticas. Excluir lead remove direto; fechar modal pode descartar alterações sem aviso.
- Não existe portal/link de aprovação de conteúdo para cliente. Há aprovação interna de vídeo editado, mas não fluxo externo controlado.
- A busca global fica no header, mas nem todas as telas usam `query`. Isso cria expectativa falsa.
- Financeiro depende de um endpoint Apps Script hardcoded em `src/main.jsx:3186`, fora do mesmo modelo de autenticação/permissão do app.
- Há função `InstagramStudio` e aba `conteudo` no código, mas elas não aparecem na navegação atual. Isso indica legado ou fluxo abandonado.

### Riscos

- Risco crítico de vazamento de dados: migrations iniciais criam policies `using (true) with check (true)` e `grant all` para `anon, authenticated`.
- Risco de operação perdida: alterações são otimistas; se `saveItem` falhar, a UI mostra sucesso e não reverte.
- Risco de inconsistência de schema: `TABLE_MAP` aponta para tabelas `dbe_*`, mas migrations criam tabelas sem prefixo.
- Risco de LGPD/compliance: campos como "Senhas e acessos", dados pessoais, WhatsApp e notas internas ficam no mesmo objeto JSONB de cliente.
- Risco de uso real no mobile: há adaptações, mas calendário, tabelas, modais grandes e revisão de vídeo ainda exigem muito espaço.

### Oportunidades

- Transformar o Cronograma em entidade central de produção: ideia -> roteiro -> gravação -> edição -> aprovação -> postagem -> performance.
- Criar uma camada de permissões por workspace/cliente e separar dados internos de dados visíveis ao cliente.
- Evoluir o cliente para dossiê operacional completo: briefing, responsáveis, contratos, arquivos, produção, aprovações, calendário e métricas em abas.
- Unificar Drive, conteúdo e aprovação: cada conteúdo deveria ter pasta, anexos, comentários, versões e status rastreável.
- Usar Deby AI dentro do fluxo, não só como tela isolada: gerar ideia, revisar roteiro, sugerir legenda, resumir feedback do cliente e apontar atrasos.

### Personas

| Persona | O que consegue fazer bem hoje | Onde ficaria perdida | O que falta para fluir melhor | Simplificações necessárias | Informações mais visíveis |
|---|---|---|---|---|---|
| Dono/gestor | Ver KPIs gerais, clientes, CRM, financeiro e produtividade parcial | Financeiro separado em Apps Script; dashboard mistura dados de `posts`, `scripts` e `cronograma`; não há visão de atrasos consolidada | Margem por cliente, inadimplência confiável, capacidade da equipe, entregas por período, histórico | Dashboard com filtros por mês/cliente/responsável e alertas acionáveis | Atrasados, gargalos, clientes sem conteúdo, contas a receber, aprovações pendentes |
| Social media | Criar conteúdo no cronograma, filtrar por cliente/status, usar calendário | Não há banco de ideias separado; transformar ideia em roteiro não é explícito | Ideias, campanhas, pilares, checklist de publicação, aprovação de legenda/arte | Um fluxo único "nova ideia" -> "virar conteúdo" -> "agendar" | Próximo conteúdo por cliente, legenda, formato, status, prazo, responsável |
| Roteirista/copywriter | Criar roteiro, gerar base, usar Deby AI, teleprompter | Roteiro está dividido entre tela `Conteudo`, Cronograma e Deby; não há versões | Editor melhor, templates, histórico, comentários, análise de roteiro, reaproveitamento | Unificar criação de roteiro no modal/página de conteúdo | Gancho, corpo, CTA, objetivo, pilar, referências, feedback anterior |
| Designer | Enxerga posts estáticos/carrosséis como formato no cronograma | Não há briefing visual, assets, status de arte, anexos estruturados ou revisão de peça | Checklist de design, pasta de referências, status de capa/arte, aprovação visual | Uma visão "minhas artes" com prazo e arquivos | Formato, dimensões, referência, copy aprovada, prazo, feedback do cliente |
| Editor de vídeo | Produção de vídeo + Drive é útil; upload de brutos/final existe | Aprovação do vídeo fica dentro do modal de conteúdo e depende de buscar arquivos no Drive | Fila de edição, responsáveis, prazo, versões, comentários por arquivo | Tela própria "revisão de vídeo" com player e histórico | Brutos recebidos, final enviado, ajustes pedidos, arquivo aprovado, prazo |
| Atendimento/CS | Conversas, dossiê de cliente e cobranças ajudam | Notas/tags de conversa ficam em localStorage; cliente não tem linha do tempo clara | Timeline do cliente, próximos passos, pendências, aprovações e histórico de contato | Dossiê com abas e ações rápidas | Última conversa, pendência, status financeiro, próximos conteúdos, aprovações abertas |
| Cliente | Diagnóstico público existe; aprovação futura é possível | Não há portal do cliente nem link de aprovação de conteúdo atual | Links seguros para aprovar/reprovar/comentar, visualizar calendário e baixar arquivos | Páginas públicas simples por token, sem login | Conteúdo a aprovar, prazo de feedback, versão atual, comentários, status |

## 3. Auditoria por área do sistema

### Dashboard inicial

**O que funciona bem:**
- Resume receita, faturas, contas a receber e pendências de conteúdo.
- Cards clicáveis abrem modais de detalhe.
- Tem atalhos para CRM, cronograma, calendário, onboarding e conversas.

**Problemas encontrados:**
- Pendências usam `state.cronograma` e `state.posts`, mas o fluxo atual principal grava em `state.scripts`. Isso pode subcontar conteúdo.
- KPIs misturam dados do Supabase/localStorage e do endpoint financeiro externo.
- Não há filtro por mês, cliente, responsável ou equipe.

**O que falta:**
- Alertas reais de atraso, aprovações vencidas, conteúdos sem responsável, clientes sem produção no mês.
- Visão de capacidade da equipe.
- Drill-down que leve diretamente ao item, não só a uma lista textual.

**Melhorias recomendadas:**
- Padronizar a fonte de conteúdo em `scripts`/conteúdos e remover dependências de `cronograma`/`posts` legados.
- Criar cards de "Atrasados", "Aguardando cliente", "Sem responsável", "Sem data de postagem".
- Adicionar filtros globais de período e cliente.

**Prioridade:**
Alta

### Clientes/projetos

**O que funciona bem:**
- Lista de clientes e dossiê com dados operacionais, cobrança, contrato, preferências e diagnósticos.
- Permite criar cobrança vinculada e alternar status.
- Integra com WhatsApp via link e copia dados.

**Problemas encontrados:**
- O modal de novo cliente é grande demais e mistura cadastro básico, cobrança, contrato, logo e preferências.
- Campo "Senhas e acessos" no cliente é risco alto se ficar em tabela com RLS permissiva.
- Não há edição/exclusão via modal; edição acontece inline no dossiê sem controle de alterações.
- Não há abas internas; o dossiê cresce verticalmente e tende a ficar pesado.

**O que falta:**
- Briefing completo por cliente, responsáveis internos, portal/pastas, histórico, arquivos, contratos e conteúdos vinculados.
- Separação entre dados internos e dados compartilháveis com cliente.
- Validação de telefone, e-mail, Instagram, mensalidade e vencimento.

**Melhorias recomendadas:**
- Dividir em abas: Dados, Briefing, Conteúdos, Arquivos, Financeiro, Contrato, Histórico.
- Criar modal curto de cadastro e página/drawer completo para edição.
- Remover senhas do JSONB de cliente; usar cofre externo ou campo criptografado com acesso restrito.

**Prioridade:**
Alta

### Roteiros

**O que funciona bem:**
- Há criação de roteiro com título, cliente, pilar, formato, status, prioridade, gancho, desenvolvimento e CTA.
- Há geração de base local e cópia do roteiro.
- Teleprompter consome roteiros salvos.

**Problemas encontrados:**
- A tela `Conteudo` não está na navegação principal; o usuário tende a usar Cronograma.
- Não há histórico de versões, comentários, análise de qualidade, revisão por pessoa ou aprovação externa.
- Aprovar/revisar muda status sem confirmação nem comentário obrigatório.

**O que falta:**
- Templates, versões, rich text, checklist de roteiro, score da Deby, reaproveitamento e duplicação.
- Fluxo explícito de ideia para roteiro.

**Melhorias recomendadas:**
- Transformar roteiro em seção dentro do conteúdo, com versões e comentários.
- Criar ação "Duplicar roteiro" e "Criar variação com Deby".
- Exigir motivo/comentário ao reprovar ou pedir ajuste.

**Prioridade:**
Alta

### Ideias de conteúdo

**O que funciona bem:**
- O formato "Ideia" existe como status/formato no Cronograma.
- Deby AI consegue salvar uma resposta como conteúdo.

**Problemas encontrados:**
- Não existe banco de ideias separado por cliente, pilar, campanha, oportunidade ou origem.
- Não há fluxo claro para aprovar ideia antes de virar roteiro.

**O que falta:**
- Backlog de ideias, tags, pilar, campanha, prioridade, score, responsável e data sugerida.
- Botão "Transformar em roteiro/conteúdo".

**Melhorias recomendadas:**
- Criar entidade `ideas` ou ao menos uma visão filtrada de conteúdos com status `Ideia`.
- Adicionar modal de transformação que preserve referência, objetivo e pilar.

**Prioridade:**
Alta

### Posts estáticos, carrosséis e Reels

**O que funciona bem:**
- Os formatos existem em `CONTENT_FORMATS`.
- O modal do Cronograma adapta recursos de Drive/revisão para "Roteiro de Reels".
- Datas de entrega, capa e postagem existem.

**Problemas encontrados:**
- Posts estáticos e carrosséis não têm campos próprios: quantidade de cards, briefing de arte, copy por card, dimensões, capa, asset final.
- Reels têm fluxo melhor que artes, mas ainda dependem de procurar arquivos no Drive manualmente.
- Não há distinção clara entre roteiro, arte, edição, revisão e postagem como subtarefas.

**O que falta:**
- Checklist por formato.
- Anexos estruturados por etapa: referência, bruto, projeto, final, capa.
- Status específicos para copy, design, edição, aprovação e postagem.

**Melhorias recomendadas:**
- Criar templates de campos por formato.
- Mostrar subtarefas por conteúdo com responsável e prazo.
- Adicionar preview de arquivos e comentários por arquivo.

**Prioridade:**
Alta

### Calendário/editorial

**O que funciona bem:**
- Possui modos de edição, capa e postagem.
- Tem visão semanal e mensal, filtros e modal de detalhes.
- É útil para escanear volume por data.

**Problemas encontrados:**
- É majoritariamente leitura; não permite criar, arrastar, reagendar ou alterar status no calendário.
- Usa dados de `scripts`, `posts` e `cronograma`, aumentando risco de inconsistência.
- No mobile, grade de 7 colunas fica muito comprimida.

**O que falta:**
- Drag and drop ou ação rápida para reagendar.
- Indicadores de atraso e conflito de capacidade.
- Visual mensal por cliente/campanha.

**Melhorias recomendadas:**
- Tornar eventos clicáveis para abrir o mesmo modal completo do conteúdo.
- Adicionar ações rápidas: reagendar, mudar status, atribuir responsável.
- Em mobile, trocar calendário mensal por agenda/lista por dia.

**Prioridade:**
Média

### Kanban/status de produção

**O que funciona bem:**
- CRM tem kanban simples.
- Produção de vídeo tem status sequencial.
- Cronograma usa badges de status.

**Problemas encontrados:**
- Não há kanban operacional de conteúdo por status/responsável.
- Status são strings soltas; não há regras de transição, responsável obrigatório ou prazo obrigatório.
- Não há visão "minhas tarefas".

**O que falta:**
- Kanban de produção: Ideia, Roteiro, Gravação, Brutos, Edição, Revisão interna, Cliente, Aprovado, Agendado, Postado.
- Responsável por etapa e SLA.

**Melhorias recomendadas:**
- Criar visão board para conteúdos filtrável por cliente/responsável.
- Registrar histórico ao trocar status.

**Prioridade:**
Alta

### Arquivos

**O que funciona bem:**
- Drive é usado para produção de vídeo e pastas de conteúdo.
- Upload resumable evita expor token diretamente no frontend.
- Conteúdo aceita links/texto de mídia.

**Problemas encontrados:**
- Arquivos de conteúdo são parte de campo textual ou array no JSONB, não uma entidade consistente.
- Upload de conversa/anexo local cria URL temporária e não envia arquivo real via WhatsApp.
- Não há permissões por cliente/pasta no app.

**O que falta:**
- Biblioteca de arquivos por cliente/conteúdo com tipo, etapa, autor, data, versão e permissão.
- Remoção/substituição de arquivos.

**Melhorias recomendadas:**
- Criar tabela `content_files`/`assets`.
- Padronizar uploads via Functions e salvar metadados no Supabase.

**Prioridade:**
Alta

### Integrações

**O que funciona bem:**
- Há cards para Supabase, Drive, OpenRouter, Meta/Instagram e WhatsApp.
- Drive, WhatsApp e Instagram têm funções serverless.
- Instagram Analytics protege tokens em tabelas revogadas para anon/authenticated.

**Problemas encontrados:**
- Integrações não parecem exigir sessão real no backend; dependem de dados de usuário enviados pelo frontend.
- Google Drive tem estado OAuth assinado, mas fallback de segredo dev existe se `OAUTH_STATE_SECRET` não estiver configurado.
- WhatsApp webhook não mostra validação de origem/assinatura no código auditado.

**O que falta:**
- Página de status técnico com último sync, erro, logs, conta conectada, botão de desconectar e teste.
- Permissões por admin para conectar/desconectar.

**Melhorias recomendadas:**
- Exigir Supabase Auth/JWT nas Functions administrativas.
- Adicionar confirmação para desconectar Instagram/Drive/WhatsApp.
- Mostrar logs de integração por cliente.

**Prioridade:**
Alta

### Configurações

**O que funciona bem:**
- Perfil, tema, membros e integrações ficam agrupados.
- Tema claro/escuro existe.

**Problemas encontrados:**
- Membros e senhas ficam no `localStorage`; não são usuários reais.
- Alterar senha não altera a senha compartilhada real; apenas mostra mensagem local.
- Editor tem restrição só de navegação; não há permissões por ação.

**O que falta:**
- Supabase Auth, convites, papéis, membros por workspace, logs de sessão.
- Permissões granulares: financeiro, clientes, conteúdo, integrações, configurações.

**Melhorias recomendadas:**
- Substituir membros locais por Auth + tabela `workspace_members`.
- Remover senha compartilhada do bundle.

**Prioridade:**
Alta

### Login/autenticação

**O que funciona bem:**
- Há tela de login e persistência de sessão local.
- Editores veem menos abas.

**Problemas encontrados:**
- Senha compartilhada e usuários fixos no frontend.
- Sessão em `localStorage` pode ser forjada.
- Não há logout/revogação real, recuperação de senha, expiração ou 2FA.

**O que falta:**
- Supabase Auth com e-mail/senha ou magic link.
- Route guard real e validação server-side.

**Melhorias recomendadas:**
- Implementar autenticação real antes de qualquer uso com dados de clientes.
- Remover credenciais hardcoded e migrar papéis para banco.

**Prioridade:**
Alta

### Layout geral, sidebar e header

**O que funciona bem:**
- Sidebar compacta com hover é elegante em desktop.
- Header mostra status de nuvem/local, busca e exportação.
- Mobile tem top bar, drawer e bottom nav.

**Problemas encontrados:**
- Sidebar por hover pode atrapalhar em notebook quando o cursor passa perto.
- Header some no mobile; com isso busca/exportação/status somem ou ficam escondidos no drawer.
- A busca global não é global de verdade.

**O que falta:**
- Breadcrumb/contexto por cliente.
- Ações principais específicas por tela no mobile.

**Melhorias recomendadas:**
- Fixar sidebar expandida/recolhida por preferência.
- Mover busca para dentro das telas ou torná-la global de fato.
- Em mobile, mostrar CTA principal da tela no top bar.

**Prioridade:**
Média

### Modais

**O que funciona bem:**
- Há modal reutilizável para cliente/lead/conteúdo.
- Financeiro, calendário e dashboard têm overlays próprios.

**Problemas encontrados:**
- Há múltiplos padrões de modal (`Modal`, `fin-modal`, painéis laterais), com UX inconsistente.
- Fechar clicando fora descarta alterações sem aviso.
- Vários modais não têm botão cancelar visível; outros têm.
- Falta validação clara e mensagens por campo.

**O que falta:**
- Modal de confirmação para exclusões e desconexões.
- Modal/drawer de detalhes rápidos de conteúdo.
- Proteção contra fechamento acidental.

**Melhorias recomendadas:**
- Padronizar um componente Dialog/Drawer com estado dirty, validação e footer fixo.
- Usar página/drawer para formulários longos, modal para ações curtas.

**Prioridade:**
Alta

### Formulários

**O que funciona bem:**
- Inputs e selects são simples e consistentes.
- Alguns campos numéricos/data existem.

**Problemas encontrados:**
- Quase não há validação além de `if (!name)` ou `if (!title)`.
- Campos obrigatórios não são marcados.
- Não há máscara para telefone, CPF, CEP, Instagram.
- Formulários longos não têm agrupamento suficiente.

**O que falta:**
- Validação por schema, erro por campo, disabled/loading por envio, prevenção de duplicados.

**Melhorias recomendadas:**
- Usar React Hook Form/Zod ou validação equivalente.
- Separar cadastro rápido de edição completa.

**Prioridade:**
Alta

### Tabelas

**O que funciona bem:**
- `DataTable` existe e financeiro tem tabelas com scroll horizontal.
- Tabelas são úteis para CRM e diagnóstico.

**Problemas encontrados:**
- `DataTable` não tem empty state próprio, ordenação, paginação ou colunas responsivas.
- Tabelas em mobile dependem de scroll horizontal.

**O que falta:**
- Busca/filtros por coluna, ordenação, exportação por tela.

**Melhorias recomendadas:**
- Criar tabela padrão com estado vazio, loading, erro, ordenação e menu de ações.

**Prioridade:**
Média

### Cards

**O que funciona bem:**
- Cards e badges ajudam a leitura.
- MiniStats são úteis para overview.

**Problemas encontrados:**
- Muitos cards mostram contagem, mas não levam diretamente ao item certo.
- Alguns cards têm informação genérica e pouca ação.

**O que falta:**
- Card de tarefa com responsável, prazo, status, cliente e próxima ação.

**Melhorias recomendadas:**
- Padronizar cards por tipo: KPI, tarefa, conteúdo, cliente, integração.

**Prioridade:**
Média

### Estados vazios

**O que funciona bem:**
- Existem mensagens como "Nenhum item encontrado" e "Cadastre ou selecione um cliente".

**Problemas encontrados:**
- Muitos estados vazios só informam, mas não sugerem o próximo passo.
- Alguns dependem de texto genérico e não têm CTA direto.

**O que falta:**
- Empty states acionáveis por área.

**Melhorias recomendadas:**
- Cada empty state deve ter uma CTA: criar cliente, criar conteúdo, conectar Drive, sincronizar Instagram.

**Prioridade:**
Média

### Estados de loading

**O que funciona bem:**
- App mostra "Carregando operação...", financeiro tem spinner, Instagram mostra loading, produção mostra "Carregando".

**Problemas encontrados:**
- Mutations principais são otimistas e não mostram loading por botão.
- Falha de `saveItem` apenas faz `console.warn`, mas o usuário recebe sucesso.

**O que falta:**
- Loading por ação e retry em falha.

**Melhorias recomendadas:**
- Tornar `updateItem` assíncrono com tratamento de erro e rollback.

**Prioridade:**
Alta

### Estados de erro

**O que funciona bem:**
- Algumas Functions retornam erro e a UI mostra notify.
- IA tem fallback local.

**Problemas encontrados:**
- Erros de banco em `db.js` são silenciosos para o usuário.
- Erros de integração não sempre indicam como resolver.

**O que falta:**
- Padrão de erro por tela e log técnico acessível a admin.

**Melhorias recomendadas:**
- Criar componente `InlineError` e central de logs.

**Prioridade:**
Alta

### Mobile/responsividade

**O que funciona bem:**
- Existem breakpoints para 1080, 768 e 480 px.
- Sidebar vira top bar/drawer/bottom nav.
- Conversas têm modo lista/chat em mobile.

**Problemas encontrados:**
- Calendário mensal e semanal ficam densos demais em celular.
- Modais grandes continuam sendo formulários longos.
- Tabelas exigem scroll horizontal.
- Bottom nav tem só quatro atalhos e pode esconder áreas importantes.

**O que falta:**
- Views mobile específicas para calendário, conteúdo e financeiro.

**Melhorias recomendadas:**
- Em mobile, priorizar lista/agenda em vez de grids.
- Usar drawers full-screen para formulários longos.

**Prioridade:**
Média

## 4. Auditoria por fluxo

| Fluxo | Status atual | Problema | Impacto | Prioridade | Recomendação |
|---|---|---|---|---|---|
| Criar novo cliente | Parcial | Modal longo, pouca validação, mistura cadastro e cobrança | Cadastro lento e erro fácil | Alta | Modal curto + página/drawer de edição completa |
| Editar cliente | Parcial | Inline no dossiê, sem histórico e sem dirty state | Alterações podem ser perdidas ou salvas sem rastreio | Alta | Drawer com abas, validação e histórico |
| Excluir cliente | Ausente | Não há ação clara | Dados podem ficar órfãos ou sem gestão | Média | Implementar arquivar antes de excluir; excluir só com confirmação |
| Criar ideia de conteúdo | Parcial | Ideia é status/formato, não entidade/visão | Ideias se misturam com produção | Alta | Criar backlog de ideias por cliente/pilar/campanha |
| Transformar ideia em roteiro | Ausente/parcial | Deby salva como conteúdo, mas não há ação de transformação | Perde contexto e rastreabilidade | Alta | Modal "Transformar em roteiro" mantendo origem |
| Organizar conteúdo por cliente | Bom/parcial | Cronograma agrupa por cliente e filtra bem | Falta visão por campanha/mês com metas | Média | Adicionar agrupamento por mês/campanha |
| Definir status de produção | Parcial | Status é select simples, sem regras/comentário | Gargalos não ficam claros | Alta | Status por etapa com responsável, prazo e histórico |
| Anexar arquivos | Parcial | Drive para Reels/vídeo; outros formatos usam textarea | Arquivos ficam desorganizados | Alta | Entidade de arquivos por conteúdo e etapa |
| Encontrar conteúdos antigos | Parcial | Filtros existem no Cronograma; busca global inconsistente | Busca pode falhar fora da tela | Média | Busca unificada por cliente/título/status/data |
| Editar informações | Parcial | Edição existe, mas sem controle de falha | Usuário acha que salvou mesmo se banco falhar | Alta | Mutations assíncronas com erro/rollback |
| Excluir informações | Fraco | Lead exclui direto; financeiro usa `confirm`; conteúdo não tem excluir | Risco de exclusão acidental e falta de operação | Alta | Modal padrão de confirmação + arquivamento |
| Revisar conteúdo antes de postar | Parcial | Revisão de vídeo existe; posts/arte/roteiro não têm revisão robusta | Aprovação interna fica informal | Alta | Fluxo de revisão com comentários e checklist |
| Aprovar conteúdo | Parcial | Aprovação interna por botão/status; sem cliente | Cliente fora do loop | Alta | Link público com token, comentário e status |
| Acompanhar atrasados | Fraco | Não há cálculo central de atraso por prazo | Gestor perde gargalos | Alta | Dashboard/kanban com atraso por data e responsável |
| Visualizar mês de produção | Parcial | Calendário mensal existe | Denso no mobile e sem capacidade | Média | Agenda mensal por cliente e lista de atrasos |
| Alternar entre clientes | Parcial | Select/lista em várias telas | Cada tela tem seletor diferente | Média | Contexto global de cliente opcional |
| Conectar integração | Parcial | Drive/WhatsApp/Instagram existem | Falta permissão real e estado técnico | Alta | Exigir admin autenticado e logar conexão |
| Desconectar integração | Parcial | Instagram tem botão; Drive não tem desconexão clara | Risco operacional | Média | Confirmar desconexão e mostrar impacto |
| Publicar no Instagram | Parcial/técnico | `meta-publish` existe, mas não aparece como fluxo principal do calendário | Usuário não posta a partir do conteúdo | Média | Integrar publicação ao conteúdo aprovado/agendado |
| Exportar workspace | Parcial | Exporta estado local sem escopo/permissão granular | Pode expor dados sensíveis | Alta | Exportação por permissão e com alerta de dados privados |

## 5. Funções que uma agência precisa e ainda faltam

| Função | Por que é importante | Existe hoje? | Prioridade | Como implementar |
|---|---|---|---|---|
| Auth real por usuário | Evita acesso indevido e viabiliza auditoria | Não | Alta | Supabase Auth + route guards + sessão JWT |
| Workspace/tenant | Se virar SaaS ou tiver clientes/equipes separadas, isola dados | Não | Alta | `workspaces`, `workspace_members`, `workspace_id` em tudo |
| RLS restritiva | Impede vazamento pelo anon key | Não nas tabelas principais | Alta | Policies por workspace/role |
| Cadastro completo de cliente em abas | Dossiê atual vai ficar pesado | Parcial | Alta | Página/drawer com abas e entidades vinculadas |
| Briefing por cliente | Base para conteúdo e onboarding | Parcial | Alta | Tabela/JSON estruturado de briefing com versionamento |
| Banco de ideias | Social media precisa backlog antes da produção | Parcial | Alta | Entidade `ideas` com pilar/campanha/status |
| Transformar ideia em roteiro | Reduz retrabalho | Não | Alta | Ação que cria conteúdo preservando origem |
| Campanhas/mês | Agência organiza produção por calendário comercial | Não | Média | `campaigns` + vínculo no conteúdo |
| Kanban de conteúdo | Mostra gargalos de produção | Parcial | Alta | Board por status com drag/drop e histórico |
| Tarefas e responsáveis | Cada etapa precisa dono | Parcial | Alta | Subtarefas por conteúdo: copy, design, edição, aprovação |
| Prazos e atrasos | Evita perder entrega/postagem | Parcial | Alta | Datas por etapa + cálculo de overdue |
| Aprovação de cliente | Fundamental para rotina de agência | Não | Alta | Links públicos tokenizados com comentários |
| Comentários internos | Centraliza feedback e decisões | Não | Alta | `comments` por entidade com autor/data |
| Comentários do cliente | Evita feedback perdido no WhatsApp | Não | Alta | Comentários em link público e notificação interna |
| Histórico de alterações | Auditoria e recuperação | Não | Alta | `activity_log` por entidade |
| Versões de roteiro | Evita perder copy anterior | Não | Média | `script_versions` ou snapshot no update |
| Anexos por cliente/conteúdo | Organização real de arquivos | Parcial | Alta | `files/assets` com Drive/Supabase Storage |
| Busca e filtros globais | Encontrar conteúdo antigo rápido | Parcial | Média | Search index por cliente/conteúdo/arquivo |
| Notificações | Aprovação/atraso/comentário exigem alerta | Não | Média | In-app notifications + WhatsApp/email depois |
| Relatórios por cliente | Mostra valor entregue | Parcial no Instagram | Média | Consolidar métricas + IA + entregas |
| Portal do cliente | Aprovação e transparência | Não | Média | Páginas tokenizadas por cliente/conteúdo |
| Produtividade da equipe | Gestor precisa saber carga e gargalo | Não | Média | Dashboard por responsável/status/prazo |
| Financeiro integrado ao contrato | Evita cobrança manual | Parcial | Média | Contrato -> invoice -> status pagamento |
| Integração Drive completa | Arquivos precisam viver no lugar certo | Parcial | Alta | Pastas por cliente/conteúdo + arquivos versionados |
| Integração Instagram no fluxo | Publicar/analisar sem sair do conteúdo | Parcial | Média | Botões no conteúdo aprovado/agendado |
| Importação/limpeza do legado Notion | Dados importados precisam governança | Parcial | Média | Importador com validação e deduplicação |

## 6. Problemas de UX

| Problema | Onde acontece | Por que atrapalha | Solução recomendada | Prioridade |
|---|---|---|---|---|
| Muitas áreas para funções parciais | Sidebar | Usuário acha que tudo está pronto | Agrupar por fluxo e esconder módulos incompletos | Alta |
| Busca global não é global | Header | Cria expectativa falsa | Buscar em todas entidades ou remover do header | Média |
| Modal de cliente grande | Clientes | Cadastro inicial fica pesado | Cadastro rápido + edição completa em abas | Alta |
| Fechamento acidental perde dados | Modais | Clique fora descarta formulário | Dirty state + confirmação ao fechar | Alta |
| Status sem contexto | Cronograma/CRM/Produção | Usuário não sabe o próximo passo | Status com próxima ação e responsável | Alta |
| Aprovação escondida | Modal de conteúdo/revisão | Cliente e equipe não veem fila de aprovação | Criar tela "Aprovações" | Alta |
| Dados financeiros em outro backend | Dashboard/Financeiro | Métricas podem divergir de clientes/faturas | Unificar fonte ou mostrar origem claramente | Alta |
| Muitas ações com ícone sem texto | Tabelas/cards | Usuário novo precisa adivinhar | Tooltips e labels em ações críticas | Média |
| Empty states pouco acionáveis | Várias telas | Não orientam próximo passo | Empty state com CTA contextual | Média |
| Tabelas horizontais no mobile | Financeiro/CRM | Scroll ruim e ações escondidas | Cards/lista mobile | Média |
| Calendário muito denso no celular | Calendário | Eventos ficam ilegíveis | Agenda/lista no mobile | Média |
| Sucesso mesmo com erro de banco | Mutations em `db.js` | Usuário perde confiança | Await, erro visível e rollback | Alta |
| Módulos legados não roteados | `Conteudo`/`InstagramStudio` | Confunde manutenção e visão de produto | Remover ou integrar oficialmente | Média |
| Sidebar por hover | Desktop/notebook | Expansão acidental | Toggle fixo expandir/recolher | Baixa |
| Falta "onde estou" por cliente | Várias telas | Alternar clientes é repetitivo | Contexto global de cliente com escopo opcional | Média |

## 7. Modais e interações

| Modal/interação | Existe? | Está adequado? | Problema | Recomendação |
|---|---|---|---|---|
| Criar cliente | Sim | Parcial | Grande demais, mistura muitos assuntos | Modal curto; edição completa em drawer/página |
| Editar cliente | Parcial | Não | Inline sem confirmação/histórico | Drawer com abas e salvar/cancelar |
| Excluir cliente | Não | Não | Sem operação clara | Preferir arquivar; excluir com confirmação |
| Criar roteiro | Sim/parcial | Parcial | Tela não está na navegação; duplicada com Cronograma | Unificar no conteúdo |
| Editar roteiro | Sim no Cronograma | Parcial | Sem versões/comentários | Modal/drawer com histórico |
| Excluir roteiro | Não | Não | Não há limpeza/arquivamento | Adicionar arquivar/excluir com confirmação |
| Criar ideia | Parcial | Não | Ideia não tem modal próprio | Criar backlog/modal de ideia |
| Transformar ideia em conteúdo | Não | Não | Fluxo inexistente | Ação dedicada com preview |
| Adicionar arquivo | Sim/parcial | Parcial | Funciona melhor para Reels/Drive; outros formatos são texto | Upload padronizado por entidade |
| Confirmar exclusão | Parcial | Não | Financeiro usa `confirm`; lead exclui direto | Dialog padrão com nome do item |
| Trocar status | Sim | Parcial | Sem comentário, regra ou confirmação | Modal leve quando status crítico |
| Duplicar conteúdo | Não | Não | Reaproveitamento manual | Botão duplicar com cliente/data/status novos |
| Conectar integração | Sim | Parcial | Sem permissão server-side real | Exigir admin JWT e registrar log |
| Desconectar integração | Parcial | Parcial | Instagram tem; Drive/WhatsApp não claro | Confirmar impacto e desconectar com log |
| Aprovar/reprovar conteúdo | Parcial | Não | Aprovação interna de vídeo, sem cliente | Fluxo de aprovação com token e comentários |
| Adicionar comentário | Parcial/local | Não | Conversa tem nota local; conteúdo não | Comentários persistidos por entidade |
| Visualizar detalhes rápidos | Sim/parcial | Parcial | Calendário mostra detalhes; cronograma abre edição direto | Quick view separado de edição |
| Modal financeiro | Sim | Parcial | Fecha clicando fora; validação fraca | Dirty state, validação e cancelar/salvar claros |
| Modal calendário filtros | Sim | Adequado/parcial | Só filtra, sem salvar preferência | Guardar filtros por usuário |

## 8. Responsividade

### Desktop

Funciona bem em desktop grande. A sidebar compacta, grids 2/3/4 colunas, calendário e produção de vídeo têm espaço suficiente. O risco em desktop é mais de densidade operacional: muitas áreas parecem completas, mas escondem fluxos parciais. Modais largos de conteúdo e revisão de vídeo são aceitáveis em tela grande.

Recomendações:
- Manter desktop como experiência principal para gestão e produção.
- Adicionar toggle fixo da sidebar.
- Melhorar drill-down de dashboard e produtividade.

### Notebook

Em notebook, a sidebar por hover e os grids grandes podem ficar menos confortáveis. O Cronograma reduz para layout de uma coluna abaixo de 1080 px, o que evita estouro, mas transforma linhas em blocos longos e aumenta scroll. Modais com muitos campos ocupam quase toda a tela.

Recomendações:
- Reduzir campos iniciais nos modais.
- Usar drawers com footer fixo para salvar/cancelar.
- Criar views de lista compacta para produção.

### Tablet

O CSS troca para layout mais vertical em 768 px. A navegação mobile ajuda, mas áreas como financeiro, calendário e produção ainda dependem de componentes densos. Tabelas com scroll horizontal são aceitáveis pontualmente, mas não para uso diário.

Recomendações:
- Criar cards responsivos para tabelas principais.
- Transformar calendário mensal em agenda.
- Usar filtros colapsáveis.

### Mobile

Há top bar, drawer e bottom nav. Conversas têm tratamento específico lista/chat, que é positivo. Mesmo assim, mobile parece mais adequado para consulta rápida e aprovação do que para operação completa. Modais longos, calendário de 7 colunas, financeiro e revisão de vídeo são difíceis em celular.

Recomendações:
- Definir mobile como experiência de consulta/aprovação/WhatsApp.
- Criar páginas públicas de aprovação mobile-first.
- Substituir tabelas por listas de cards no mobile.
- Expor CTA principal no top bar da tela atual.

## 9. Segurança e permissões

### Riscos confirmados

- Autenticação local no frontend: usuários e senha compartilhada estão em `src/main.jsx`; sessão é apenas objeto em `localStorage`.
- Roles são apenas UI. O editor vê menos abas, mas o banco e Functions não têm autorização forte baseada em sessão real.
- RLS permissiva nas tabelas principais: migration inicial cria `for all to anon, authenticated using (true) with check (true)` e `grant all`.
- Dados sensíveis de cliente, incluindo credenciais, podem ser salvos no mesmo JSONB de `clients`.
- Mutations do frontend usam anon key para tabelas principais via Supabase client.
- `db.js` usa tabelas `dbe_*`, mas migrations versionadas criam tabelas sem prefixo; isso pode quebrar ou mascarar política de segurança real.
- Financeiro usa endpoint externo hardcoded no frontend.
- WhatsApp webhook não mostra validação de assinatura/origem no código analisado.
- Exportar workspace pode gerar arquivo com todos os dados carregados, sem filtro de permissão.

### Riscos possíveis

- Se as tabelas `dbe_*` existirem no banco real com policy permissiva similar, qualquer usuário com anon key pode ler/escrever registros.
- Uploads do WhatsApp em bucket público podem expor mídia recebida se bucket/URLs forem públicos sem controle.
- Google Drive cria permissões públicas de leitura em helper compartilhado; precisa validar onde é chamado e se arquivos sensíveis podem ficar públicos.
- Functions que usam service role podem aceitar ações administrativas sem autenticação real, dependendo da rota.
- O endpoint Apps Script financeiro pode aceitar POST sem autenticação forte; precisa validar no script externo.

### O que precisa ser validado

- Estado real do banco Supabase: existem `dbe_clients`/`dbe_scripts`? Quais policies estão ativas nelas?
- Buckets `wa-media` e `dbe-docs`: públicos ou privados? Há policies de Storage?
- Netlify env vars: `OAUTH_STATE_SECRET`/`META_OAUTH_STATE_SECRET` estão definidos ou usando fallback dev?
- Apps Script financeiro: há token/assinatura/allowlist?
- Webhook Evolution: há segredo, assinatura ou validação de instância?
- Quais dados reais já foram importados para JSONB e se há credenciais pessoais dentro.

### Recomendações de segurança

- Bloquear uso real com dados sensíveis até migrar para Supabase Auth e RLS restritiva.
- Remover senha compartilhada e membros locais.
- Criar `workspace_id` e `client_id` em todas as entidades sensíveis.
- Separar `client_credentials` em cofre seguro ou remover do app.
- Mover financeiro para Function autenticada ou backend próprio.
- Tornar uploads privados por padrão e gerar signed URLs quando necessário.
- Exigir JWT nas Functions de integração e validar role admin no servidor.
- Adicionar activity log para criação, edição, exclusão, conexão e aprovação.

## 10. Organização técnica

- Dividir `src/main.jsx` por features: `clients`, `content`, `calendar`, `production`, `finance`, `conversations`, `integrations`, `settings`, `auth`.
- Separar componentes base (`Modal`, `Panel`, `DataTable`, `Badge`, `Input`, `Select`, `Toast`) de lógica de domínio.
- Remover ou integrar funções não roteadas (`Conteudo`, `InstagramStudio`) para reduzir ambiguidade.
- Padronizar o modelo de dados: hoje há `scripts`, `posts`, `cronograma` e `video_projects` com sobreposição.
- Corrigir divergência entre migrations e `TABLE_MAP`.
- Trocar JSONB genérico por tabelas tipadas nas entidades críticas: clientes, conteúdos, comentários, arquivos, tarefas, aprovações.
- Criar camada de services por domínio, com tratamento de erro consistente e retorno tipado.
- Migrar para TypeScript antes de escalar novas features.
- Substituir mutations otimistas sem await por fluxo com loading, erro e rollback.
- Criar testes mínimos para helpers de normalização de conteúdo, status, datas e permissões.
- Code split por rota/feature: bundle atual minificado ficou grande e o Vite alertou chunk acima de 500 kB.
- Padronizar modais: um componente para dialog, um para drawer, um para confirmação.
- Centralizar constantes de status/formato/prioridade e mapear transições permitidas.
- Remover dependência direta de Apps Script no frontend ou encapsular via Function.

## 11. Roadmap de melhoria

### Fase 1 — Correções críticas

O que precisa ser feito primeiro para o sistema ficar seguro e usável:

- Implementar Supabase Auth real.
- Corrigir schema `dbe_*` vs migrations.
- Aplicar RLS restritiva por workspace/usuário.
- Remover senha compartilhada e membros em localStorage.
- Bloquear/criptografar/remover campo de senhas/acessos de clientes.
- Corrigir `updateItem`/`saveItem` para mostrar erro real e não sucesso falso.
- Adicionar confirmação para exclusão, desconexão e fechamento de modal com alterações.
- Definir fonte única de conteúdo (`scripts`/`contents`) e parar de misturar `posts`/`cronograma` legado.

### Fase 2 — Melhorias de experiência

O que melhora muito o uso diário:

- Reestruturar cliente em dossiê com abas.
- Criar visão "Minhas tarefas" e kanban de conteúdo.
- Criar backlog de ideias com transformação em roteiro/conteúdo.
- Melhorar modais longos com drawers e validação.
- Criar agenda mobile/lista para calendário.
- Padronizar estados vazios, loading e erro.
- Tornar busca realmente global ou escopada por tela.

### Fase 3 — Funções estratégicas para agência

O que transforma o DBE Flow em ferramenta mais completa:

- Aprovação de cliente por link tokenizado.
- Comentários internos e do cliente por conteúdo/arquivo.
- Histórico de alterações e versões de roteiro.
- Arquivos/anexos estruturados por cliente/conteúdo/etapa.
- Campanhas e organização por mês.
- Relatórios por cliente com entregas, aprovações, métricas e insights.
- Portal simples do cliente para aprovações e calendário.

### Fase 4 — Automação e inteligência

O que pode ser feito depois com IA, integrações e relatórios:

- Deby AI contextual dentro de cada fluxo: ideias, roteiro, legenda, revisão, feedback e relatório.
- Notificações de atraso/aprovação por WhatsApp/e-mail.
- Sync avançado Instagram e publicação a partir de conteúdo aprovado.
- Automação de cobrança e lembretes.
- Painel de produtividade e capacidade da equipe.
- Importador assistido para dados legados/Notion.

## 12. Lista de tarefas para implementação

Atualização de execução: as migrations `0008`, `0009`, `0010` e `0011` foram validadas no Supabase real. A migration `0012_entity_files.sql` foi aplicada para anexos estruturados por entidade.

- [ ] Migrar autenticação para Supabase Auth
  - Arquivos prováveis: `src/main.jsx`, `src/lib/supabase.js`, novas migrations de `profiles/workspaces/workspace_members`
  - Risco: Alto
  - Prioridade: Alta

- [ ] Corrigir divergência entre `TABLE_MAP` e migrations
  - Arquivos prováveis: `src/lib/db.js`, `supabase/migrations/*`, Functions que buscam `clients/dbe_clients`
  - Risco: Alto
  - Prioridade: Alta

- [ ] Implementar RLS por workspace/usuário nas tabelas principais
  - Arquivos prováveis: `supabase/migrations/*`
  - Risco: Alto
  - Prioridade: Alta

- [ ] Remover senha compartilhada e membros locais
  - Arquivos prováveis: `src/main.jsx`
  - Risco: Alto
  - Prioridade: Alta

- [ ] Remover/segregar campo de senhas e acessos do cliente
  - Arquivos prováveis: `src/main.jsx`, migrations de clientes/segredos
  - Risco: Alto
  - Prioridade: Alta

- [ ] Tornar `addItem/updateItem/removeItem` assíncronos com erro e rollback
  - Arquivos prováveis: `src/main.jsx`, `src/lib/db.js`
  - Risco: Médio
  - Prioridade: Alta

- [x] Criar modal padrão de confirmação destrutiva
  - Arquivos prováveis: `src/main.jsx`, futura pasta `src/components`
  - Risco: Baixo
  - Prioridade: Alta

- [x] Adicionar proteção de fechamento com alterações não salvas
  - Arquivos prováveis: componente `Modal`, modais de cliente/conteúdo/financeiro
  - Risco: Médio
  - Prioridade: Alta

- [x] Unificar entidade de conteúdo
  - Arquivos prováveis: `src/main.jsx`, `src/lib/db.js`, migrations
  - Risco: Alto
  - Prioridade: Alta

- [x] Criar backlog de ideias
  - Arquivos prováveis: nova feature `ideas`, migrations, `CronogramaConteudo`, `DebyAI`
  - Risco: Médio
  - Prioridade: Alta

- [x] Criar fluxo "transformar ideia em roteiro/conteúdo"
  - Arquivos prováveis: `CronogramaConteudo`, nova entidade/serviço de conteúdo
  - Risco: Médio
  - Prioridade: Alta

- [x] Criar kanban de produção de conteúdo
  - Arquivos prováveis: `CronogramaConteudo`, novos componentes board/status
  - Risco: Médio
  - Prioridade: Alta

- [x] Adicionar responsáveis e prazos por etapa
  - Arquivos prováveis: migrations de conteúdo/tarefas, modal de conteúdo
  - Risco: Médio
  - Prioridade: Alta

- [ ] Criar comentários persistidos por conteúdo/arquivo
  - Arquivos prováveis: migrations `comments`, modal/drawer de conteúdo
  - Risco: Médio
  - Prioridade: Alta

- [ ] Criar histórico de alterações
  - Arquivos prováveis: migrations `activity_logs`, services de mutations
  - Risco: Médio
  - Prioridade: Alta

- [ ] Criar aprovação pública por token
  - Arquivos prováveis: novas Functions, novas páginas/rotas, migrations `approvals`
  - Risco: Alto
  - Prioridade: Alta

- [x] Estruturar arquivos/anexos por entidade
  - Arquivos prováveis: migrations `files/assets`, Functions Drive/Storage, modal de conteúdo
  - Risco: Médio
  - Prioridade: Alta

- [x] Reestruturar dossiê do cliente em abas
  - Arquivos prováveis: `Clientes`, novos componentes de cliente
  - Risco: Médio
  - Prioridade: Média

- [ ] Criar agenda mobile para calendário
  - Arquivos prováveis: `Calendario`, `src/styles.css`
  - Risco: Baixo
  - Prioridade: Média

- [ ] Criar busca global real
  - Arquivos prováveis: header/app shell, services de busca, talvez índice no banco
  - Risco: Médio
  - Prioridade: Média

- [ ] Encapsular financeiro em backend autenticado
  - Arquivos prováveis: `FinanceiroCompleto`, nova Function, possível migração de dados
  - Risco: Alto
  - Prioridade: Alta

- [ ] Exigir JWT/role admin nas Functions de integração
  - Arquivos prováveis: `netlify/functions/*`, `src/lib/api.js`
  - Risco: Alto
  - Prioridade: Alta

- [ ] Validar e proteger webhook WhatsApp
  - Arquivos prováveis: `netlify/functions/whatsapp-webhook.mjs`
  - Risco: Alto
  - Prioridade: Alta

- [ ] Criar central de logs de integração
  - Arquivos prováveis: migrations logs, `Integracoes`, Functions
  - Risco: Médio
  - Prioridade: Média

- [ ] Migrar o monólito para arquitetura por features
  - Arquivos prováveis: `src/main.jsx`, nova estrutura `src/features/*`, `src/components/*`, `src/services/*`
  - Risco: Alto
  - Prioridade: Média

- [ ] Adotar TypeScript gradualmente
  - Arquivos prováveis: `src/*`, config Vite/TS
  - Risco: Médio
  - Prioridade: Média

- [ ] Adicionar testes mínimos de helpers e fluxo de dados
  - Arquivos prováveis: helpers de conteúdo, datas, permissões, normalização
  - Risco: Baixo
  - Prioridade: Média
