import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  BadgeDollarSign,
  Bot,
  CalendarDays,
  Camera,
  Check,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  Film,
  FolderOpen,
  Gauge,
  HardDrive,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  MonitorPlay,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  WalletCards,
  Wand2,
} from 'lucide-react'
import { format } from 'date-fns'
import './styles.css'
import logo from './assets/logo-dbe.png'
import { isSupabaseConfigured } from './lib/supabase'
import { loadAll, insertItem, saveItem, deleteItem, loadVideoProjects, loadVideoProjectFiles, loadDriveIntegration, updateVideoProject } from './lib/db'
import { whatsapp, meta, ai, contract, drive } from './lib/api'

const STORAGE_KEY = 'dbe-flow-state-v1'

const nav = [
  { id: 'dashboard', label: 'Central', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'diagnostico', label: 'Diagnóstico', icon: Gauge },
  { id: 'onboarding', label: 'Onboarding', icon: ClipboardCheck },
  { id: 'contratos', label: 'Contratos', icon: FileSignature },
  { id: 'conteudo', label: 'Roteiros', icon: FileText },
  { id: 'teleprompter', label: 'Teleprompter', icon: MonitorPlay },
  { id: 'ai', label: 'Deby AI', icon: Sparkles },
  { id: 'instagram', label: 'Instagram', icon: Camera },
  { id: 'conversas', label: 'Conversas', icon: MessageCircle },
  { id: 'producao', label: 'Produção', icon: Film },
  { id: 'financeiro', label: 'Financeiro', icon: WalletCards },
  { id: 'integracoes', label: 'Integrações', icon: Settings },
]

const seed = {
  clients: [
    { id: 'c1', name: 'Dra. Marina Lopes', phone: '5582999991001', instagram: '@dramarinalopes', segment: 'Dermatologia', plan: 'Autoridade Médica', status: 'Ativo', monthly: 6200, owner: 'DBE', next: 'Gravação quinzenal' },
    { id: 'c2', name: 'Clínica Atrium', phone: '5582999991002', instagram: '@clinicaatrium', segment: 'Odontologia premium', plan: 'Performance', status: 'Onboarding', monthly: 7800, owner: 'Comercial', next: 'Aprovar tom de voz' },
    { id: 'c3', name: 'Dr. Rafael Nunes', phone: '5582999991003', instagram: '@drrafaelnunes', segment: 'Ortopedia', plan: 'Conteúdo + Tráfego', status: 'Renovação', monthly: 5200, owner: 'Sucesso', next: 'Reunião de renovação' },
  ],
  leads: [
    { id: 'l1', name: 'Dra. Helena Cruz', phone: '5582999990001', source: 'Diagnóstico', specialty: 'Nutrologia', value: 72000, status: 'Proposta', temp: 'Quente', next: 'Follow-up proposta', notes: 'Quer paciente particular e tem agenda instável.' },
    { id: 'l2', name: 'Instituto Vitta', phone: '5582999990002', source: 'Instagram', specialty: 'Clínica multidisciplinar', value: 94000, status: 'Reunião', temp: 'Morno', next: 'Enviar diagnóstico', notes: 'Lead com maturidade, precisa organizar decisores.' },
    { id: 'l3', name: 'Dr. Miguel Prado', phone: '5582999990003', source: 'Indicação', specialty: 'Cardiologia', value: 36000, status: 'Contato', temp: 'Frio', next: 'WhatsApp inicial', notes: 'Pediu exemplos antes de marcar call.' },
  ],
  scripts: [
    { id: 's1', title: 'O erro que faz o paciente adiar a consulta', client: 'Dra. Marina Lopes', pillar: 'Autoridade', status: 'Aprovado', hook: 'Se o seu paciente só procura ajuda quando piora, sua comunicação está chegando tarde.', body: 'Explique que conteúdo precisa antecipar dúvidas e reduzir medo antes da consulta.', cta: 'Salve este vídeo para lembrar antes da próxima avaliação.' },
    { id: 's2', title: 'Bastidores do planejamento de sorriso', client: 'Clínica Atrium', pillar: 'Prova de método', status: 'Em revisão', hook: 'Um sorriso previsível começa antes da cadeira odontológica.', body: 'Mostre etapas do planejamento, critérios e cuidados sem prometer resultado.', cta: 'Envie uma mensagem para entender se este planejamento faz sentido para você.' },
    { id: 's3', title: 'Dor no joelho não é sentença', client: 'Dr. Rafael Nunes', pillar: 'Educação', status: 'Rascunho', hook: 'Nem toda dor no joelho significa cirurgia.', body: 'Fale sobre avaliação, histórico, exames e condutas progressivas.', cta: 'Procure avaliação se a dor limita sua rotina.' },
  ],
  posts: [
    { id: 'p1', client: 'Dra. Marina Lopes', network: 'Instagram', date: '2026-05-24T10:00', status: 'Agendado', caption: 'Como identificar sinais que merecem avaliação dermatológica sem prometer resultado.' },
    { id: 'p2', client: 'Clínica Atrium', network: 'Instagram', date: '2026-05-25T18:30', status: 'Revisão', caption: 'O que acontece por trás de um planejamento estético seguro.' },
    { id: 'p3', client: 'Dr. Rafael Nunes', network: 'Reels', date: '2026-05-26T12:00', status: 'Produção', caption: 'Três cuidados para voltar ao treino com responsabilidade.' },
  ],
  invoices: [
    { id: 'f1', client: 'Dra. Marina Lopes', due: '2026-05-28', value: 6200, status: 'A receber' },
    { id: 'f2', client: 'Clínica Atrium', due: '2026-06-02', value: 7800, status: 'A receber' },
    { id: 'f3', client: 'Dr. Rafael Nunes', due: '2026-05-20', value: 5200, status: 'Pago' },
  ],
  automations: [
    { id: 'a1', name: 'Lead quente do diagnóstico', channel: 'Conversas WhatsApp', status: 'Pronto', trigger: 'Novo lead com score acima de 70' },
    { id: 'a2', name: 'Aprovação de post', channel: 'WhatsApp + link', status: 'Rascunho', trigger: 'Post movido para revisão' },
    { id: 'a3', name: 'Cobrança amigável', channel: 'Conversas WhatsApp', status: 'Pronto', trigger: 'Fatura vence em 2 dias' },
  ],
  contracts: [],
  diagnostics: [],
  briefings: [
    { id: 'b1', client: 'Clínica Atrium', stage: 'Identidade', progress: 68, blocker: 'Falta tom de voz aprovado' },
    { id: 'b2', client: 'Dra. Marina Lopes', stage: 'Calendário inicial', progress: 92, blocker: 'Validar datas de gravação' },
  ],
}

function App() {
  const [active, setActive] = useState('dashboard')
  const [state, setState] = useState(seed)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const isPublicDiagnostic = new URLSearchParams(window.location.search).get('diagnostico') === 'publico'

  // Lida com redirect do callback OAuth do Google Drive
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'integracoes') {
      setActive('integracoes')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Carrega os dados (nuvem se Supabase configurado; senão localStorage)
  useEffect(() => {
    let alive = true
    loadAll(seed)
      .then((loaded) => { if (alive) setState(loaded) })
      .catch((err) => console.warn('[app] loadAll', err))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // No modo local, espelha o estado inteiro no navegador
  useEffect(() => {
    if (!isSupabaseConfigured && !loading) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state, loading])

  const metrics = useMemo(() => {
    const monthly = state.clients.reduce((sum, c) => sum + Number(c.monthly || 0), 0)
    const pipeline = state.leads.reduce((sum, l) => sum + Number(l.value || 0), 0)
    const pendingApprovals = state.posts.filter((p) => ['Revisão', 'Produção'].includes(p.status)).length
    const receivable = state.invoices.filter((i) => i.status !== 'Pago').reduce((sum, i) => sum + Number(i.value || 0), 0)
    return { monthly, pipeline, pendingApprovals, receivable }
  }, [state])

  // Adiciona: persiste no banco e usa o registro retornado (com id real)
  const addItem = async (key, item) => {
    const record = await insertItem(key, item)
    setState((current) => ({ ...current, [key]: [record, ...(current[key] || [])] }))
    return record
  }
  // Atualiza: aplica patch local + salva o registro completo no banco
  const updateItem = (key, id, patch) => {
    const current = (state[key] || []).find((item) => item.id === id) || {}
    const merged = { ...current, ...patch }
    setState((cur) => ({ ...cur, [key]: cur[key].map((item) => item.id === id ? merged : item) }))
    saveItem(key, id, merged)
  }
  // Remove: tira do estado + apaga no banco
  const removeItem = (key, id) => {
    setState((cur) => ({ ...cur, [key]: cur[key].filter((item) => item.id !== id) }))
    deleteItem(key, id)
  }
  // Diagnóstico → salva o laudo e cria um lead no CRM, ambos no banco
  const addDiagnosticSubmission = async (submission) => {
    const score = calculateDiagnosticScore(submission)
    const loss = calculateDiagnosticLoss(submission, score)
    const draft = { ...submission, score, loss, createdAt: new Date().toISOString() }
    const record = await insertItem('diagnostics', draft)
    const lead = await insertItem('leads', {
      name: submission.name,
      phone: submission.phone,
      source: 'Diagnóstico',
      specialty: submission.specialty,
      value: loss * 12,
      status: 'Novo',
      temp: score > 70 ? 'Quente' : 'Morno',
      next: 'Apresentar laudo',
      notes: diagnosticSummary(record, score, loss, calculateDiagnosticProjection(record)),
    })
    setState((current) => ({
      ...current,
      diagnostics: [record, ...(current.diagnostics || [])],
      leads: [lead, ...(current.leads || [])],
    }))
    return record
  }

  if (isPublicDiagnostic) {
    return <PublicDiagnosticPage onSubmit={addDiagnosticSubmission} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={logo} alt="DBE" />
          <div>
            <strong>DBE Flow</strong>
            <span>Marketing OS</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => setActive(item.id)}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Sistema completo DBE</p>
            <h1>{nav.find((item) => item.id === active)?.label || 'DBE Flow'}</h1>
          </div>
          <div className="top-actions">
            <Badge text={isSupabaseConfigured ? (loading ? 'Sincronizando...' : 'Nuvem') : 'Local'} tone={isSupabaseConfigured ? 'success' : 'gold'} />
            <label className="search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, lead, roteiro..." />
            </label>
            <button className="primary" onClick={() => exportWorkspace(state)}>
              <UploadCloud size={16} />
              Exportar
            </button>
          </div>
        </header>

        {active === 'dashboard' && <Dashboard state={state} metrics={metrics} setActive={setActive} />}
        {active === 'clientes' && <Clientes state={state} addItem={addItem} updateItem={updateItem} query={query} />}
        {active === 'crm' && <Crm state={state} addItem={addItem} updateItem={updateItem} removeItem={removeItem} query={query} />}
        {active === 'diagnostico' && <Diagnostico state={state} addDiagnosticSubmission={addDiagnosticSubmission} />}
        {active === 'onboarding' && <Onboarding state={state} addItem={addItem} updateItem={updateItem} />}
        {active === 'contratos' && <Contratos state={state} addItem={addItem} updateItem={updateItem} />}
        {active === 'conteudo' && <Conteudo state={state} addItem={addItem} updateItem={updateItem} />}
        {active === 'teleprompter' && <Teleprompter scripts={state.scripts} />}
        {active === 'ai' && <DebyAI state={state} />}
        {active === 'instagram' && <InstagramStudio state={state} addItem={addItem} updateItem={updateItem} />}
        {active === 'conversas' && <Conversas state={state} addItem={addItem} />}
        {active === 'producao' && <ProducaoVideo state={state} updateItem={updateItem} />}
        {active === 'financeiro' && <Financeiro state={state} addItem={addItem} updateItem={updateItem} metrics={metrics} />}
        {active === 'integracoes' && <Integracoes />}
      </main>
    </div>
  )
}

function Dashboard({ state, metrics, setActive }) {
  const cards = [
    { label: 'Receita mensal gerida', value: money(metrics.monthly), icon: BadgeDollarSign, action: 'financeiro' },
    { label: 'Pipeline comercial', value: money(metrics.pipeline), icon: Target, action: 'crm' },
    { label: 'Posts em produção', value: metrics.pendingApprovals, icon: Megaphone, action: 'instagram' },
    { label: 'Contas a receber', value: money(metrics.receivable), icon: WalletCards, action: 'financeiro' },
  ]
  return (
    <section className="page-grid">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Central de comando</p>
          <h2>DBE Flow junta operação, comercial, conteúdo, financeiro e automações em um só painel.</h2>
          <p>O app nasce local-first para uso imediato e já deixa os pontos críticos preparados para deploy com Supabase, OpenAI/OpenRouter, Meta, Conversas/WhatsApp e Netlify.</p>
        </div>
        <div className="hero-stack">
          <span>12 módulos integrados</span>
          <strong>{state.clients.length + state.leads.length + state.scripts.length + state.posts.length}</strong>
          <small>registros operacionais ativos</small>
        </div>
      </div>

      <div className="kpi-grid">
        {cards.map((card) => (
          <button className="kpi-card" key={card.label} onClick={() => setActive(card.action)}>
            <card.icon size={20} />
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </button>
        ))}
      </div>

      <div className="grid-2">
        <Panel title="Funil comercial" action="Abrir CRM" onAction={() => setActive('crm')}>
          <Pipeline leads={state.leads} />
        </Panel>
        <Panel title="Agenda de produção" action="Instagram" onAction={() => setActive('instagram')}>
          <Timeline posts={state.posts} />
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Clientes em operação" action="Onboarding" onAction={() => setActive('onboarding')}>
          <div className="stack-list">
            {state.clients.map((client) => (
              <ListItem key={client.id} title={client.name} meta={`${client.segment} · ${client.plan} · ${money(client.monthly)}/mês`} badge={client.status} />
            ))}
          </div>
        </Panel>
        <Panel title="Próximas ações recomendadas" action="Conversas" onAction={() => setActive('conversas')}>
          <ActionList
            items={[
              ['Responder leads quentes', `${state.leads.filter((lead) => lead.temp === 'Quente').length} lead(s) com prioridade comercial`],
              ['Enviar posts para revisão', `${state.posts.filter((post) => post.status === 'Revisão').length} item(ns) aguardando cliente`],
              ['Cobranças pendentes', `${state.invoices.filter((invoice) => invoice.status === 'A receber').length} fatura(s) a acompanhar`],
            ]}
          />
        </Panel>
      </div>
    </section>
  )
}

function Clientes({ state, addItem, updateItem, query }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(state.clients[0]?.id || '')
  const [form, setForm] = useState({ name: '', phone: '', instagram: '', segment: '', plan: 'Autoridade Médica', status: 'Onboarding', monthly: 6200, owner: 'DBE', next: 'Briefing inicial' })
  const clients = state.clients.filter((client) => JSON.stringify(client).toLowerCase().includes(query.toLowerCase()))
  const selected = state.clients.find((client) => client.id === selectedId) || state.clients[0]
  const selectedDiagnostics = (state.diagnostics || []).filter((item) => item.name === selected?.name || item.phone === selected?.phone)

  return (
    <section className="page-grid">
      <div className="grid-4">
        <MiniStat label="Clientes ativos" value={state.clients.filter((c) => c.status === 'Ativo').length} tone="success" />
        <MiniStat label="Onboarding" value={state.clients.filter((c) => c.status === 'Onboarding').length} tone="gold" />
        <MiniStat label="MRR clientes" value={money(state.clients.reduce((sum, c) => sum + Number(c.monthly || 0), 0))} />
        <MiniStat label="Diagnósticos salvos" value={(state.diagnostics || []).length} tone="blue" />
      </div>

      <div className="client-layout">
        <Panel title="Carteira" action="Novo cliente" onAction={() => setModalOpen(true)}>
          <div className="stack-list">
            {clients.map((client) => (
              <button key={client.id} className={`client-row ${selected?.id === client.id ? 'active' : ''}`} onClick={() => setSelectedId(client.id)}>
                <span>{initials(client.name)}</span>
                <div>
                  <strong>{client.name}</strong>
                  <small>{client.segment} · {client.instagram || 'sem Instagram'}</small>
                </div>
                <Badge text={client.status} tone={client.status === 'Ativo' ? 'success' : 'gold'} />
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Dossiê do cliente">
          {selected ? (
            <div className="client-dossier">
              <div className="dossier-head">
                <div className="avatar-lg">{initials(selected.name)}</div>
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.segment} · {selected.plan}</p>
                </div>
                <Badge text={selected.status} tone={selected.status === 'Ativo' ? 'success' : 'gold'} />
              </div>
              <div className="grid-3">
                <MiniStat label="Mensalidade" value={money(selected.monthly)} tone="success" />
                <MiniStat label="Responsável" value={selected.owner || 'DBE'} />
                <MiniStat label="Próxima ação" value={selected.next || 'Definir'} tone="gold" />
              </div>
              <div className="button-row">
                <button className="secondary" onClick={() => openWhatsApp(selected.phone, `Olá ${selected.name}, aqui é da DBE. Passando para alinhar: ${selected.next || 'próximo passo'}.`)}><MessageCircle size={16} /> Conversar</button>
                <button className="secondary" onClick={() => copyText(JSON.stringify(selected, null, 2))}><Copy size={16} /> Copiar dados</button>
                <button className="primary" onClick={() => updateItem('clients', selected.id, { status: selected.status === 'Ativo' ? 'Onboarding' : 'Ativo' })}><RefreshCw size={16} /> Alternar status</button>
              </div>
              <h3>Diagnósticos vinculados</h3>
              {selectedDiagnostics.length ? (
                <div className="stack-list">
                  {selectedDiagnostics.map((item) => <ListItem key={item.id} title={`${item.specialty} · score ${item.score}`} meta={`${dateTime(item.createdAt)} · perda ${money(item.loss)}/mês`} badge="Diagnóstico" />)}
                </div>
              ) : (
                <div className="empty-box">Nenhum diagnóstico vinculado a este cliente ainda.</div>
              )}
            </div>
          ) : <div className="empty-box">Cadastre ou selecione um cliente.</div>}
        </Panel>
      </div>

      <Modal title="Novo cliente" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="form-grid">
          <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Input label="WhatsApp" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <Input label="Instagram" value={form.instagram} onChange={(instagram) => setForm({ ...form, instagram })} />
          <Input label="Segmento" value={form.segment} onChange={(segment) => setForm({ ...form, segment })} />
          <Select label="Plano" value={form.plan} onChange={(plan) => setForm({ ...form, plan })} options={['Autoridade Médica', 'Performance', 'Conteúdo + Tráfego', 'Consultoria']} />
          <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={['Onboarding', 'Ativo', 'Renovação', 'Pausado']} />
          <Input label="Mensalidade" type="number" value={form.monthly} onChange={(monthly) => setForm({ ...form, monthly })} />
          <Input label="Próxima ação" value={form.next} onChange={(next) => setForm({ ...form, next })} />
          <button className="primary span" onClick={() => { if (form.name) { addItem('clients', form); setModalOpen(false) } }}><Plus size={16} /> Salvar cliente</button>
        </div>
      </Modal>
    </section>
  )
}

function Crm({ state, addItem, updateItem, removeItem, query }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', specialty: '', source: 'Instagram', value: 48000, temp: 'Morno', status: 'Novo', next: 'Primeiro contato', notes: '' })
  const rows = state.leads.filter((lead) => JSON.stringify(lead).toLowerCase().includes(query.toLowerCase()))
  const stages = ['Novo', 'Contato', 'Reunião', 'Proposta', 'Contrato']
  const nextStage = (status) => stages[Math.min(stages.indexOf(status) + 1, stages.length - 1)] || 'Contato'
  return (
    <section className="page-grid">
      <div className="grid-4">
        <MiniStat label="Leads" value={state.leads.length} />
        <MiniStat label="Quentes" value={state.leads.filter((l) => l.temp === 'Quente').length} tone="danger" />
        <MiniStat label="Ticket potencial" value={money(state.leads.reduce((sum, l) => sum + Number(l.value || 0), 0))} tone="gold" />
        <MiniStat label="Em proposta" value={state.leads.filter((l) => l.status === 'Proposta').length} tone="success" />
      </div>
      <Panel title="Captação rápida" action="Novo lead" onAction={() => setModalOpen(true)}>
        <ActionList
          items={[
            ['Diagnóstico público', 'Envie o link da aba Diagnóstico para o lead preencher sozinho'],
            ['Lead manual', 'Cadastre contatos vindos de Instagram, indicação, tráfego ou evento'],
            ['Próximo passo', 'Use Conversas para acionar pelo WhatsApp'],
          ]}
        />
      </Panel>
      <Modal title="Novo lead" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="form-grid">
          <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Input label="WhatsApp" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <Input label="Especialidade" value={form.specialty} onChange={(specialty) => setForm({ ...form, specialty })} />
          <Select label="Origem" value={form.source} onChange={(source) => setForm({ ...form, source })} options={['Diagnóstico', 'Instagram', 'Indicação', 'Tráfego pago', 'Evento']} />
          <Select label="Temperatura" value={form.temp} onChange={(temp) => setForm({ ...form, temp })} options={['Quente', 'Morno', 'Frio']} />
          <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={stages} />
          <Input label="Valor potencial" type="number" value={form.value} onChange={(value) => setForm({ ...form, value })} />
          <Input label="Próximo passo" value={form.next} onChange={(next) => setForm({ ...form, next })} />
          <label className="field span">
            <span>Notas comerciais</span>
            <textarea className="textarea" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          <button className="primary span" onClick={() => { if (form.name) { addItem('leads', form); setModalOpen(false) } }}>
            <UserPlus size={16} /> Adicionar ao CRM
          </button>
        </div>
      </Modal>
      <Panel title="Kanban comercial">
        <div className="kanban">
          {stages.map((stage) => (
            <div className="kanban-col" key={stage}>
              <div className="kanban-title"><span>{stage}</span><strong>{state.leads.filter((lead) => lead.status === stage).length}</strong></div>
              {state.leads.filter((lead) => lead.status === stage).map((lead) => (
                <article className="kanban-card" key={lead.id}>
                  <Badge text={lead.temp} tone={lead.temp === 'Quente' ? 'danger' : lead.temp === 'Morno' ? 'gold' : 'blue'} />
                  <h3>{lead.name}</h3>
                  <p>{lead.specialty} · {money(lead.value)}</p>
                  <div className="button-row compact">
                    <button className="secondary" onClick={() => updateItem('leads', lead.id, { status: nextStage(lead.status), next: 'Próxima etapa: ' + nextStage(lead.status) })}>
                      <Check size={14} /> Avançar
                    </button>
                    <button className="ghost" onClick={() => openWhatsApp(lead.phone, leadMessage(lead))}>
                      <MessageCircle size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Pipeline">
        <DataTable
          columns={['Lead', 'Origem', 'Temperatura', 'Status', 'Valor', 'Próximo passo', 'Ações']}
          rows={rows.map((lead) => [
            <div><strong>{lead.name}</strong><small>{lead.specialty}</small></div>,
            lead.source,
            <Badge text={lead.temp} tone={lead.temp === 'Quente' ? 'danger' : lead.temp === 'Morno' ? 'gold' : 'blue'} />,
            lead.status,
            money(lead.value),
            lead.next,
            <div className="row-actions">
              <button className="icon-btn" title="WhatsApp" onClick={() => openWhatsApp(lead.phone, leadMessage(lead))}><MessageCircle size={15} /></button>
              <button className="icon-btn" title="Copiar briefing" onClick={() => copyText(leadBrief(lead))}><Copy size={15} /></button>
              <button className="icon-btn danger" title="Excluir" onClick={() => removeItem('leads', lead.id)}><Trash2 size={15} /></button>
            </div>,
          ])}
        />
      </Panel>
    </section>
  )
}

function Diagnostico({ state, addDiagnosticSubmission }) {
  const [data, setData] = useState({ name: '', phone: '', specialty: '', ticket: 700, patients: 40, convenios: 20, agenda: 'Oscila', valuePerception: 'Desvalorizado', social: 'Posta pouco', camera: 'Trava para gravar', paid: 'Não investe' })
  const score = calculateDiagnosticScore(data)
  const loss = calculateDiagnosticLoss(data, score)
  const projected = calculateDiagnosticProjection(data)
  const diagnosticText = diagnosticSummary(data, score, loss, projected)
  const publicLink = `${window.location.origin}${window.location.pathname}?diagnostico=publico&token=dbe-${Date.now()}`
  return (
    <section className="page-grid">
      <Panel title="Link para o cliente responder sozinho">
        <div className="share-link-row">
          <input readOnly value={publicLink} />
          <button className="secondary" onClick={() => copyText(publicLink)}><Copy size={16} /> Copiar link</button>
          <button className="primary" onClick={() => window.open(publicLink, '_blank')}><Eye size={16} /> Abrir</button>
        </div>
        <p className="muted-note">Quando estiver online, este link será enviado ao cliente. Por enquanto, no local, a resposta fica salva neste navegador em `Diagnósticos` e entra no CRM como lead.</p>
      </Panel>

      <div className="grid-2 align-start">
      <Panel title="Diagnóstico de posicionamento">
        <div className="form-grid">
          <Input label="Nome do lead" value={data.name} onChange={(name) => setData({ ...data, name })} />
          <Input label="WhatsApp" value={data.phone} onChange={(phone) => setData({ ...data, phone })} />
          <Input label="Especialidade" value={data.specialty} onChange={(specialty) => setData({ ...data, specialty })} />
          <Input label="Ticket médio" type="number" value={data.ticket} onChange={(ticket) => setData({ ...data, ticket })} />
          <Input label="Pacientes/mês" type="number" value={data.patients} onChange={(patients) => setData({ ...data, patients })} />
          <Input label="Convênios/mês" type="number" value={data.convenios} onChange={(convenios) => setData({ ...data, convenios })} />
          <Select label="Agenda" value={data.agenda} onChange={(agenda) => setData({ ...data, agenda })} options={['Cheia', 'Oscila', 'Buracos frequentes']} />
          <Select label="Valor cobrado" value={data.valuePerception} onChange={(valuePerception) => setData({ ...data, valuePerception })} options={['Bem posicionado', 'Desvalorizado', 'Convênio dita valor']} />
          <Select label="Conteúdo" value={data.social} onChange={(social) => setData({ ...data, social })} options={['Posta pouco', 'Posta toda semana', 'Posta todo dia']} />
          <Select label="Câmera" value={data.camera} onChange={(camera) => setData({ ...data, camera })} options={['Natural', 'Trava para gravar', 'Não grava']} />
          <Select label="Tráfego pago" value={data.paid} onChange={(paid) => setData({ ...data, paid })} options={['Não investe', 'Faz sozinho', 'Tem agência']} />
          <button className="primary span" onClick={() => data.name && addDiagnosticSubmission(data)}>
            <Send size={16} /> Enviar para CRM
          </button>
        </div>
      </Panel>
      <Panel title="Laudo gerado">
        <div className="score-ring">
          <strong>{score}</strong>
          <span>score comercial</span>
        </div>
        <div className="result-box danger">
          <span>Perda estimada</span>
          <strong>{money(loss)}/mês</strong>
          <p>Com base em ticket, frequência de conteúdo, objeção de câmera e maturidade de tráfego.</p>
        </div>
        <div className="result-box success">
          <span>Potencial reposicionado</span>
          <strong>{money(projected)}/mês</strong>
          <p>Projeção conservadora com aumento de percepção de valor e demanda mais qualificada.</p>
        </div>
        <div className="script-preview">
          <strong>Abordagem sugerida</strong>
          <p>{data.name || 'Lead'}, hoje o problema não parece ser demanda. O gargalo está em transformar autoridade clínica em percepção de valor antes da consulta.</p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => copyText(diagnosticText)}><Copy size={16} /> Copiar laudo</button>
          <button className="primary" onClick={() => downloadText('laudo-dbe.txt', diagnosticText)}><Download size={16} /> Baixar laudo</button>
        </div>
      </Panel>
      </div>

      <Panel title="Respostas recebidas">
        <DataTable
          columns={['Lead', 'Score', 'Perda estimada', 'Perfil', 'Data']}
          rows={(state.diagnostics || []).map((item) => [
            <div><strong>{item.name}</strong><small>{item.specialty}</small></div>,
            <Badge text={String(item.score)} tone={item.score > 70 ? 'danger' : 'gold'} />,
            `${money(item.loss)}/mês`,
            `${item.agenda} · ${item.social} · ${item.camera}`,
            dateTime(item.createdAt),
          ])}
        />
      </Panel>
    </section>
  )
}

function PublicDiagnosticPage({ onSubmit }) {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(null)
  const [data, setData] = useState({ name: '', phone: '', specialty: '', ticket: 700, patients: 40, convenios: 20, agenda: 'Oscila', valuePerception: 'Desvalorizado', social: 'Posta pouco', camera: 'Trava para gravar', paid: 'Não investe' })
  const questions = [
    { key: 'agenda', title: 'Como está sua agenda hoje?', options: ['Cheia', 'Oscila', 'Buracos frequentes'] },
    { key: 'valuePerception', title: 'Como você sente a percepção de valor do paciente?', options: ['Bem posicionado', 'Desvalorizado', 'Convênio dita valor'] },
    { key: 'social', title: 'Qual sua frequência de conteúdo?', options: ['Posta pouco', 'Posta toda semana', 'Posta todo dia'] },
    { key: 'camera', title: 'Como é sua relação com a câmera?', options: ['Natural', 'Trava para gravar', 'Não grava'] },
    { key: 'paid', title: 'Você investe em tráfego pago?', options: ['Não investe', 'Faz sozinho', 'Tem agência'] },
  ]

  const submit = () => {
    const record = onSubmit(data)
    setDone(record)
  }

  if (done) {
    return (
      <div className="public-page">
        <div className="public-card">
          <img src={logo} alt="DBE" />
          <p className="eyebrow">Diagnóstico recebido</p>
          <h1>{done.name}, seu Raio-X foi salvo.</h1>
          <div className="grid-3">
            <MiniStat label="Score" value={done.score} tone={done.score > 70 ? 'danger' : 'gold'} />
            <MiniStat label="Perda estimada" value={`${money(done.loss)}/mês`} tone="danger" />
            <MiniStat label="Potencial" value={`${money(calculateDiagnosticProjection(done))}/mês`} tone="success" />
          </div>
          <p>A equipe DBE usará essas respostas para preparar sua leitura estratégica.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="public-page">
      <div className="public-card">
        <img src={logo} alt="DBE" />
        <p className="eyebrow">Raio-X de posicionamento</p>
        <h1>Descubra onde sua comunicação médica está perdendo valor.</h1>
        <Progress value={Math.round(((step + 1) / 7) * 100)} />

        {step === 0 && (
          <div className="form-grid">
            <Input label="Nome" value={data.name} onChange={(name) => setData({ ...data, name })} />
            <Input label="WhatsApp" value={data.phone} onChange={(phone) => setData({ ...data, phone })} />
            <Input label="Especialidade" value={data.specialty} onChange={(specialty) => setData({ ...data, specialty })} />
            <button className="primary span" disabled={!data.name || !data.specialty} onClick={() => setStep(1)}>Começar</button>
          </div>
        )}

        {step > 0 && step <= questions.length && (
          <div className="question-block">
            <h2>{questions[step - 1].title}</h2>
            <div className="option-list">
              {questions[step - 1].options.map((option) => (
                <button key={option} className={data[questions[step - 1].key] === option ? 'selected' : ''} onClick={() => { setData({ ...data, [questions[step - 1].key]: option }); setStep(step + 1) }}>
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === questions.length + 1 && (
          <div className="form-grid">
            <Input label="Ticket médio" type="number" value={data.ticket} onChange={(ticket) => setData({ ...data, ticket })} />
            <Input label="Pacientes/mês" type="number" value={data.patients} onChange={(patients) => setData({ ...data, patients })} />
            <Input label="Atendimentos de convênio/mês" type="number" value={data.convenios} onChange={(convenios) => setData({ ...data, convenios })} />
            <button className="primary span" onClick={submit}>Finalizar diagnóstico</button>
          </div>
        )}

        {step > 0 && <button className="ghost public-back" onClick={() => setStep(Math.max(0, step - 1))}>Voltar</button>}
      </div>
    </div>
  )
}

function Onboarding({ state, addItem, updateItem }) {
  const [form, setForm] = useState({ client: '', stage: 'Raio-X clínico', progress: 10, blocker: 'Aguardando briefing inicial' })
  const checklist = ['Briefing recebido', 'Mapa de mercado', 'Pilares aprovados', 'Primeira pauta', 'Gravação agendada', 'Calendário publicado']
  return (
    <section className="page-grid">
      <div className="grid-3">
        <MiniStat label="Jornadas abertas" value={state.briefings.length} />
        <MiniStat label="Média de avanço" value={`${Math.round(state.briefings.reduce((sum, item) => sum + Number(item.progress), 0) / Math.max(1, state.briefings.length))}%`} tone="success" />
        <MiniStat label="Pendências" value={state.briefings.filter((item) => Number(item.progress) < 100).length} tone="gold" />
      </div>
      <Panel title="Novo onboarding">
        <div className="form-grid">
          <Input label="Cliente" value={form.client} onChange={(client) => setForm({ ...form, client })} />
          <Select label="Etapa" value={form.stage} onChange={(stage) => setForm({ ...form, stage })} options={['Raio-X clínico', 'Identidade', 'Mapa de mercado', 'Pilares', 'Calendário inicial', 'Primeira gravação']} />
          <Input label="Progresso (%)" type="number" value={form.progress} onChange={(progress) => setForm({ ...form, progress })} />
          <Input label="Pendência" value={form.blocker} onChange={(blocker) => setForm({ ...form, blocker })} />
          <button className="primary span" onClick={() => form.client && addItem('briefings', form)}>
            <Plus size={16} /> Criar jornada
          </button>
        </div>
      </Panel>
      <div className="cards-grid">
        {state.briefings.map((item) => (
          <article className="work-card" key={item.id}>
            <div>
              <Badge text={item.stage} tone="blue" />
              <h3>{item.client}</h3>
              <p>{item.blocker}</p>
            </div>
            <ActionList items={checklist.map((step, index) => [step, Number(item.progress) >= (index + 1) * 16 ? 'Concluído' : 'Pendente'])} compact />
            <Progress value={Number(item.progress)} />
            <div className="button-row compact">
              <button className="secondary" onClick={() => updateItem('briefings', item.id, { progress: Math.min(100, Number(item.progress) + 10) })}><Check size={14} /> Avançar</button>
              <button className="ghost" onClick={() => copyText(`Onboarding ${item.client}\nEtapa: ${item.stage}\nProgresso: ${item.progress}%\nPendência: ${item.blocker}`)}><Copy size={14} /> Copiar status</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Contratos({ state, addItem, updateItem }) {
  const clientNames = state.clients.map((c) => c.name)
  const [form, setForm] = useState({
    nome: clientNames[0] || '',
    descricao_cliente: '',
    rg: '',
    cpf: '',
    rua: '',
    numero: '',
    bairro: '',
    cep: '',
    phone: state.clients[0]?.phone || '',
    meses: 6,
    videos_mes: 4,
    artes_mes: 4,
    valor_parcela: 6200,
    parcelas: 6,
    dia_pagamento: 5,
  })
  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }))
  const totalVideos = Number(form.videos_mes) * Number(form.meses)
  const totalArtes = Number(form.artes_mes) * Number(form.meses)
  const valorTotal = Number(form.valor_parcela) * Number(form.parcelas)

  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [lastBase64, setLastBase64] = useState(null)
  const [savedId, setSavedId] = useState(null)

  // Preenche telefone e nome ao selecionar cliente existente
  const selectClient = (nome) => {
    const c = state.clients.find((cl) => cl.name === nome)
    setForm((f) => ({ ...f, nome, phone: c?.phone || f.phone }))
  }

  const buildPayload = () => ({
    ...form,
    meses: Number(form.meses),
    videos_mes: Number(form.videos_mes),
    artes_mes: Number(form.artes_mes),
    valor_parcela: Number(form.valor_parcela),
    parcelas: Number(form.parcelas),
    dia_pagamento: Number(form.dia_pagamento),
    contract_id: savedId,
  })

  const handleGenerate = async () => {
    if (!form.nome) { setFeedback('Informe o nome do contratante.'); return }
    setGenerating(true); setFeedback('Gerando DOCX...')
    let id = savedId
    if (!id) {
      const rec = await addItem('contracts', {
        ...form, valorTotal, totalVideos, totalArtes, createdAt: new Date().toISOString(),
      })
      id = rec.id
      setSavedId(id)
    }
    const res = await contract.generate({ ...buildPayload(), contract_id: id })
    setGenerating(false)
    if (!res.ok) { setFeedback(`Erro: ${res.error}`); return }
    setLastBase64(res.base64)
    if (res.publicUrl && id) updateItem('contracts', id, { docx_url: res.publicUrl })
    // Dispara download automático
    const a = document.createElement('a')
    a.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${res.base64}`
    a.download = `Contrato-DBE-${form.nome.replace(/\s+/g, '-')}.docx`
    a.click()
    setFeedback('✅ Contrato gerado e baixado!')
  }

  const handleSendWhatsApp = async () => {
    if (!lastBase64) { setFeedback('Gere o contrato primeiro.'); return }
    if (!form.phone) { setFeedback('Informe o telefone do cliente.'); return }
    setSending(true); setFeedback('Enviando pelo WhatsApp...')
    const fileName = `Contrato-DBE-${form.nome.replace(/\s+/g, '-')}.docx`
    const res = await whatsapp.sendDocument(form.phone, lastBase64, fileName, `Olá ${form.nome}! Segue o contrato DBE para assinatura. Qualquer dúvida estamos à disposição.`)
    setSending(false)
    if (res.ok) {
      setFeedback('✅ Contrato enviado pelo WhatsApp!')
      if (savedId) updateItem('contracts', savedId, { sent_via_whatsapp: true, sent_at: new Date().toISOString() })
    } else {
      setFeedback(`⚠️ Erro: ${res.error}`)
    }
  }

  return (
    <section className="page-grid">
      <div className="grid-3">
        <MiniStat label="Valor total" value={money(valorTotal)} tone="success" />
        <MiniStat label="Parcela" value={money(form.valor_parcela)} tone="blue" />
        <MiniStat label="Entregas totais" value={`${totalVideos} vídeos · ${totalArtes} artes`} tone="gold" />
      </div>
      <div className="grid-2 align-start">
        <Panel title="Gerador de contrato oficial DBE">
          <div className="form-grid">
            <Select label="Cliente (existente)" value={form.nome} onChange={selectClient} options={clientNames.length ? clientNames : ['—']} />
            <Input label="Nome completo do contratante" value={form.nome} onChange={set('nome')} />
            <Input label="Descrição (ex: Dra. Maria Silva, cardiologista)" value={form.descricao_cliente} onChange={set('descricao_cliente')} />
            <Input label="CPF" value={form.cpf} onChange={set('cpf')} />
            <Input label="RG" value={form.rg} onChange={set('rg')} />
            <Input label="Rua" value={form.rua} onChange={set('rua')} />
            <Input label="Número" value={form.numero} onChange={set('numero')} />
            <Input label="Bairro" value={form.bairro} onChange={set('bairro')} />
            <Input label="CEP" value={form.cep} onChange={set('cep')} />
            <Input label="WhatsApp (com DDI, ex: 5582999999)" value={form.phone} onChange={set('phone')} />
            <Input label="Duração (meses)" type="number" value={form.meses} onChange={set('meses')} />
            <Input label="Vídeos por mês" type="number" value={form.videos_mes} onChange={set('videos_mes')} />
            <Input label="Artes por mês" type="number" value={form.artes_mes} onChange={set('artes_mes')} />
            <Input label="Valor da parcela (R$)" type="number" value={form.valor_parcela} onChange={set('valor_parcela')} />
            <Input label="Nº de parcelas" type="number" value={form.parcelas} onChange={set('parcelas')} />
            <Input label="Dia do vencimento" type="number" value={form.dia_pagamento} onChange={set('dia_pagamento')} />
          </div>
          {feedback && <p className="muted-note" style={{ marginTop: 8 }}>{feedback}</p>}
          <div className="button-row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={handleGenerate} disabled={generating}>
              <Download size={16} /> {generating ? 'Gerando...' : 'Gerar DOCX'}
            </button>
            <button className="secondary" onClick={handleSendWhatsApp} disabled={sending || !lastBase64}>
              <Send size={16} /> {sending ? 'Enviando...' : 'Enviar por WhatsApp'}
            </button>
          </div>
        </Panel>

        <Panel title="Contratos gerados">
          {state.contracts.length === 0
            ? <p className="muted-note">Nenhum contrato gerado ainda.</p>
            : <div className="stack-list">
                {state.contracts.map((c) => (
                  <div key={c.id} className="list-item">
                    <div>
                      <strong>{c.nome || c.client}</strong>
                      <small> · {c.meses || c.months} meses · {money(c.valorTotal || c.total)}</small>
                    </div>
                    <div className="button-row compact">
                      {c.docx_url && (
                        <a className="secondary" href={c.docx_url} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', gap:4, fontSize:13 }}>
                          <Download size={13} /> Baixar
                        </a>
                      )}
                      <Badge text={c.sent_via_whatsapp ? 'Enviado' : 'Não enviado'} tone={c.sent_via_whatsapp ? 'success' : 'gold'} />
                    </div>
                  </div>
                ))}
              </div>
          }
        </Panel>
      </div>
    </section>
  )
}

function Conteudo({ state, addItem, updateItem }) {
  const [form, setForm] = useState({ title: '', client: state.clients[0]?.name || '', pillar: 'Autoridade', status: 'Rascunho', hook: '', body: '', cta: '' })
  const draft = buildScriptDraft(form)
  return (
    <section className="page-grid">
      <Panel title="Novo roteiro">
        <div className="form-grid">
          <Input label="Título" value={form.title} onChange={(title) => setForm({ ...form, title })} />
          <Select label="Cliente" value={form.client} onChange={(client) => setForm({ ...form, client })} options={state.clients.map((c) => c.name)} />
          <Select label="Pilar" value={form.pillar} onChange={(pillar) => setForm({ ...form, pillar })} options={['Autoridade', 'Educação', 'Prova de método', 'Oferta', 'Bastidores']} />
          <Input label="Gancho" value={form.hook} onChange={(hook) => setForm({ ...form, hook })} />
          <label className="field">
            <span>Desenvolvimento</span>
            <textarea className="textarea" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          </label>
          <Input label="CTA" value={form.cta} onChange={(cta) => setForm({ ...form, cta })} />
          <button className="secondary" onClick={() => setForm({ ...form, ...suggestScript(form.pillar, form.client) })}><Wand2 size={16} /> Gerar base</button>
          <button className="secondary" onClick={() => copyText(draft)}><Copy size={16} /> Copiar roteiro</button>
          <button className="primary span" onClick={() => form.title && addItem('scripts', form)}><Plus size={16} /> Salvar roteiro</button>
        </div>
      </Panel>
      <div className="cards-grid">
        {state.scripts.map((script) => (
          <article className="work-card" key={script.id}>
            <Badge text={script.status} tone={script.status === 'Aprovado' ? 'success' : 'gold'} />
            <h3>{script.title}</h3>
            <p>{script.hook}</p>
            <small>{script.client} · {script.pillar}</small>
            <div className="script-score">
              <span>Gancho</span><strong>{script.hook?.length > 35 ? 'Forte' : 'Ajustar'}</strong>
              <span>CTA</span><strong>{script.cta ? 'Claro' : 'Falta'}</strong>
            </div>
            <div className="button-row compact">
              <button className="secondary" onClick={() => updateItem('scripts', script.id, { status: script.status === 'Aprovado' ? 'Aprovado' : 'Em revisão' })}><Eye size={14} /> Revisão</button>
              <button className="secondary" onClick={() => updateItem('scripts', script.id, { status: 'Aprovado' })}><Check size={14} /> Aprovar</button>
              <button className="ghost" onClick={() => copyText(buildScriptDraft(script))}><Copy size={14} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Teleprompter({ scripts }) {
  const [selected, setSelected] = useState(scripts[0]?.id)
  const [font, setFont] = useState(42)
  const [speed, setSpeed] = useState(1)
  const [running, setRunning] = useState(false)
  const [mirror, setMirror] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const readerRef = useRef(null)
  const script = scripts.find((item) => item.id === selected) || scripts[0]
  const text = `${script?.hook || ''}\n\nDesenvolvimento:\n${script?.body || '1. Mostre o problema de forma simples.\n2. Explique a causa provável sem prometer resultado.\n3. Traga uma orientação segura.'}\n\nCTA:\n${script?.cta || 'Se esse conteúdo fez sentido, envie para alguém que precisa ouvir isso hoje.'}`

  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => {
      if (readerRef.current) readerRef.current.scrollTop += Number(speed) * 1.8
    }, 70)
    return () => window.clearInterval(interval)
  }, [running, speed])

  return (
    <section className={focusMode ? 'teleprompter-page focus' : 'teleprompter-page'}>
      <Panel title="Controle">
        <div className="form-grid">
          <Select label="Roteiro" value={selected} onChange={setSelected} options={scripts.map((s) => ({ label: s.title, value: s.id }))} />
          <Input label="Tamanho" type="number" value={font} onChange={setFont} />
          <Input label="Velocidade" type="number" value={speed} onChange={setSpeed} />
          <div className="button-row no-margin">
            <button className="primary" onClick={() => setRunning(!running)}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'Pausar' : 'Iniciar'}</button>
            <button className="secondary" onClick={() => { if (readerRef.current) readerRef.current.scrollTop = 0 }}><RefreshCw size={16} /> Reiniciar</button>
            <button className="secondary" onClick={() => setMirror(!mirror)}>Espelhar</button>
            <button className="secondary" onClick={() => setFocusMode(!focusMode)}>{focusMode ? 'Sair do foco' : 'Modo foco'}</button>
          </div>
        </div>
      </Panel>
      <div className="teleprompter-stage">
        <div className="read-line" />
        <div ref={readerRef} className={mirror ? 'reader mirror' : 'reader'} style={{ fontSize: `${font}px` }}>
          {text.split('\n').map((line, index) => <p key={index}>{line || ' '}</p>)}
        </div>
        <div className="teleprompter-footer">
          <span>{script?.title}</span>
          <strong>{running ? 'Gravando leitura' : 'Pausado'}</strong>
          <span>{Math.ceil(text.length / 850)} min estimado</span>
        </div>
      </div>
    </section>
  )
}

function DebyAI({ state }) {
  const [input, setInput] = useState('Gerar roteiro para um médico que trava na câmera e precisa atrair paciente particular.')
  const [feature, setFeature] = useState('roteiro')
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // presets: [label, prompt, feature da IA]
  const presets = [
    ['Roteiro', 'Gerar roteiro para um médico que trava na câmera e precisa atrair paciente particular.', 'roteiro'],
    ['Análise', 'Analisar se este roteiro tem gancho, tensão, prova e CTA claro.', 'analise'],
    ['Objeções', 'Criar respostas para objeções de preço em uma proposta de assessoria DBE.', 'objecoes'],
    ['Legenda', 'Gerar legenda de Instagram segura para marketing médico, sem prometer resultado.', 'legenda'],
  ]
  const context = `Cliente de referência: ${state.clients?.[0]?.name || 'Cliente DBE'}. Especialidades: ${(state.clients || []).map((c) => c.segment).join(', ')}.`

  const generate = async () => {
    setBusy(true); setErr('')
    const res = await ai.ask(feature, input, context)
    setBusy(false)
    if (res.ok) setOutput(res.text)
    else { setErr(res.error || 'Falha na IA'); setOutput(buildAiOutput(input, state)) }
  }

  const shown = output || buildAiOutput(input, state)
  return (
    <section className="grid-2 align-start">
      <Panel title="Deby AI">
        <div className="preset-row">
          {presets.map(([label, prompt, feat]) => (
            <button key={label} className={feature === feat ? 'ghost active' : 'ghost'} onClick={() => { setInput(prompt); setFeature(feat) }}>{label}</button>
          ))}
        </div>
        <textarea className="textarea large" value={input} onChange={(event) => setInput(event.target.value)} />
        {err && <p className="muted-note" style={{ color: '#c0392b' }}>IA indisponível ({err}). Mostrando resposta local.</p>}
        <div className="button-row">
          <button className="primary" onClick={generate} disabled={busy}><Sparkles size={16} /> {busy ? 'Gerando...' : 'Gerar com IA'}</button>
          <button className="secondary" onClick={() => copyText(shown)}><Copy size={16} /> Copiar</button>
          <button className="secondary" onClick={() => downloadText('deby-ai-resposta.txt', shown)}><Download size={16} /> Baixar</button>
        </div>
      </Panel>
      <Panel title="Resposta da Deby">
        <pre className="ai-output">{busy ? 'A Deby está pensando...' : shown}</pre>
      </Panel>
    </section>
  )
}

function InstagramStudio({ state, addItem, updateItem }) {
  const [form, setForm] = useState({ client: state.clients[0]?.name || '', network: 'Instagram', date: '2026-05-27T10:00', status: 'Produção', caption: '' })
  const postStatuses = ['Produção', 'Revisão', 'Aprovado', 'Agendado', 'Publicado']
  return (
    <section className="page-grid">
      <div className="grid-4">
        <MiniStat label="Posts" value={state.posts.length} />
        <MiniStat label="Em revisão" value={state.posts.filter((p) => p.status === 'Revisão').length} tone="gold" />
        <MiniStat label="Agendados" value={state.posts.filter((p) => p.status === 'Agendado').length} tone="success" />
        <MiniStat label="Publicados" value={state.posts.filter((p) => p.status === 'Publicado').length} tone="blue" />
      </div>
      <Panel title="Novo post">
        <div className="form-grid">
          <Select label="Cliente" value={form.client} onChange={(client) => setForm({ ...form, client })} options={state.clients.map((c) => c.name)} />
          <Select label="Rede" value={form.network} onChange={(network) => setForm({ ...form, network })} options={['Instagram', 'Reels', 'Stories', 'LinkedIn']} />
          <Input label="Data" type="datetime-local" value={form.date} onChange={(date) => setForm({ ...form, date })} />
          <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={postStatuses} />
          <Input label="Legenda" value={form.caption} onChange={(caption) => setForm({ ...form, caption })} />
          <button className="secondary" onClick={() => setForm({ ...form, caption: generateCaption(form.client) })}><Wand2 size={16} /> Gerar legenda</button>
          <button className="primary span" onClick={() => form.caption && addItem('posts', form)}><CalendarDays size={16} /> Agendar</button>
        </div>
      </Panel>
      <Panel title="Esteira de conteúdo">
        <div className="kanban">
          {postStatuses.map((status) => (
            <div className="kanban-col" key={status}>
              <div className="kanban-title"><span>{status}</span><strong>{state.posts.filter((post) => post.status === status).length}</strong></div>
              {state.posts.filter((post) => post.status === status).map((post) => (
                <article className="kanban-card" key={post.id}>
                  <Badge text={post.network} tone="blue" />
                  <h3>{post.client}</h3>
                  <p>{post.caption}</p>
                  <small>{dateTime(post.date)}</small>
                  <div className="button-row compact">
                    <button className="secondary" onClick={() => updateItem('posts', post.id, { status: nextFrom(postStatuses, post.status) })}><Check size={14} /> Avançar</button>
                    <button className="ghost" onClick={() => copyText(approvalMessage(post))}><Copy size={14} /></button>
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Calendário editorial">
        <Timeline posts={state.posts} />
      </Panel>
    </section>
  )
}

function Conversas({ state, addItem }) {
  const contacts = [
    ...state.leads.map((lead) => ({ ...lead, type: 'Lead', subtitle: `${lead.status} · ${lead.temp}`, last: lead.next || lead.notes })),
    ...state.clients.map((client) => ({ ...client, type: 'Cliente', subtitle: `${client.status} · ${client.plan}`, last: client.next || client.segment })),
  ]
  const [contactId, setContactId] = useState(contacts[0]?.id || '')
  const [templateType, setTemplateType] = useState('Diagnóstico')
  const selected = contacts.find((item) => item.id === contactId) || contacts[0]
  const [draft, setDraft] = useState('')
  const message = draft || conversationTemplate(templateType, selected)
  const [form, setForm] = useState({ name: '', channel: 'Conversas WhatsApp', status: 'Rascunho', trigger: 'Novo lead cadastrado' })
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')

  // Envia DE VERDADE pela Evolution API (via função serverless). Cai para o
  // wa.me (abrir WhatsApp manualmente) se a API não responder.
  const sendReal = async () => {
    if (!selected?.phone) { setFeedback('Contato sem telefone.'); return }
    setSending(true); setFeedback('')
    const res = await whatsapp.send(selected.phone, message)
    setSending(false)
    if (res.ok) { setFeedback('✅ Enviado pelo WhatsApp.'); setDraft('') }
    else { setFeedback(`⚠️ ${res.error}. Abrindo WhatsApp manual...`); openWhatsApp(selected.phone, message) }
  }
  return (
    <section className="conversation-shell">
      <aside className="conversation-list">
        <div className="conversation-sidebar-head">
          <div>
            <p className="eyebrow">Conversas</p>
            <h2>Caixa DBE</h2>
          </div>
          <Badge text="Evolution ready" tone="blue" />
        </div>
        <label className="search conversation-search">
          <Search size={16} />
          <input placeholder="Buscar contato" />
        </label>
        <div className="chat-list">
          {contacts.map((contact) => (
            <button key={contact.id} className={selected?.id === contact.id ? 'active' : ''} onClick={() => { setContactId(contact.id); setDraft('') }}>
              <span className="chat-avatar">{initials(contact.name)}</span>
              <div>
                <strong>{contact.name}</strong>
                <small>{contact.subtitle}</small>
              </div>
              <em>{contact.type}</em>
            </button>
          ))}
        </div>
      </aside>

      <main className="conversation-main">
        <header className="chat-head">
          <div className="chat-avatar">{initials(selected?.name || 'DBE')}</div>
          <div>
            <h2>{selected?.name || 'Selecione um contato'}</h2>
            <p>{selected?.phone || 'WhatsApp ainda não cadastrado'} · {selected?.subtitle}</p>
          </div>
          <button className="secondary" onClick={() => selected && openWhatsApp(selected.phone, message)}><MessageCircle size={16} /> Abrir WhatsApp</button>
        </header>

        <div className="chat-body">
          <div className="message-bubble inbound">
            <span>{selected?.last || 'Contato aguardando primeira mensagem.'}</span>
            <small>Entrada simulada</small>
          </div>
          <div className="message-bubble outbound">
            <span>{conversationTemplate(templateType, selected)}</span>
            <small>Modelo DBE</small>
          </div>
        </div>

        <footer className="chat-compose">
          <Select label="Modelo" value={templateType} onChange={(type) => { setTemplateType(type); setDraft('') }} options={['Diagnóstico', 'Aprovação', 'Cobrança', 'Reativação']} />
          <textarea value={message} onChange={(event) => setDraft(event.target.value)} />
          {feedback && <small className="muted-note">{feedback}</small>}
          <button className="secondary" onClick={() => copyText(message)}><Copy size={16} /></button>
          <button className="secondary" onClick={() => selected && openWhatsApp(selected.phone, message)} title="Abrir no WhatsApp Web"><MessageCircle size={16} /></button>
          <button className="primary" onClick={sendReal} disabled={sending}><Send size={16} /> {sending ? 'Enviando...' : 'Enviar'}</button>
        </footer>
      </main>

      <aside className="conversation-tools">
        <Panel title="Automações">
          <div className="form-grid single">
            <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} />
            <Input label="Gatilho" value={form.trigger} onChange={(trigger) => setForm({ ...form, trigger })} />
            <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={['Rascunho', 'Pronto', 'Pausado']} />
            <button className="primary" onClick={() => form.name && addItem('automations', form)}><Plus size={16} /> Criar</button>
          </div>
          <div className="stack-list">
            {state.automations.map((item) => <ListItem key={item.id} title={item.name} meta={item.trigger} badge={item.status} />)}
          </div>
        </Panel>
        <Panel title="Dados do contato">
          {selected && <ActionList items={[
            ['Tipo', selected.type],
            ['Telefone', selected.phone || 'Não informado'],
            ['Status', selected.status || '-'],
            ['Origem/plano', selected.source || selected.plan || '-'],
          ]} />}
        </Panel>
      </aside>
    </section>
  )
}
function Financeiro({ state, addItem, updateItem, metrics }) {
  const [form, setForm] = useState({ client: state.clients[0]?.name || '', due: '2026-06-05', value: 6200, status: 'A receber' })
  const overdue = state.invoices.filter((invoice) => invoice.status !== 'Pago' && new Date(invoice.due) < new Date())
  return (
    <section className="page-grid">
      <div className="grid-4">
        <MiniStat label="MRR" value={money(metrics.monthly)} tone="success" />
        <MiniStat label="A receber" value={money(metrics.receivable)} tone="gold" />
        <MiniStat label="Inadimplência" value={money(state.invoices.filter((i) => i.status === 'Atrasado').reduce((s, i) => s + Number(i.value), 0))} tone="danger" />
        <MiniStat label="Vencidas" value={overdue.length} tone="danger" />
      </div>
      <Panel title="Nova cobrança">
        <div className="form-grid">
          <Select label="Cliente" value={form.client} onChange={(client) => setForm({ ...form, client })} options={state.clients.map((c) => c.name)} />
          <Input label="Vencimento" type="date" value={form.due} onChange={(due) => setForm({ ...form, due })} />
          <Input label="Valor" type="number" value={form.value} onChange={(value) => setForm({ ...form, value })} />
          <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={['A receber', 'Pago', 'Atrasado']} />
          <button className="primary span" onClick={() => addItem('invoices', form)}><Plus size={16} /> Adicionar cobrança</button>
        </div>
      </Panel>
      <Panel title="Recebíveis">
        <DataTable columns={['Cliente', 'Vencimento', 'Valor', 'Status', 'Ações']} rows={state.invoices.map((i) => [
          i.client,
          date(i.due),
          money(i.value),
          <Badge text={i.status} tone={i.status === 'Pago' ? 'success' : i.status === 'Atrasado' ? 'danger' : 'gold'} />,
          <div className="row-actions">
            <button className="icon-btn" title="Marcar pago" onClick={() => updateItem('invoices', i.id, { status: 'Pago' })}><Check size={15} /></button>
            <button className="icon-btn" title="Copiar cobrança" onClick={() => copyText(invoiceMessage(i))}><Copy size={15} /></button>
            <button className="icon-btn danger" title="Atrasado" onClick={() => updateItem('invoices', i.id, { status: 'Atrasado' })}><Activity size={15} /></button>
          </div>,
        ])} />
      </Panel>
    </section>
  )
}

function ProducaoVideo({ state, updateItem }) {
  const [driveConn, setDriveConn] = useState(undefined) // undefined=loading, null=sem conta
  const [selectedClientName, setSelectedClientName] = useState(state.clients[0]?.name || '')
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [projectFiles, setProjectFiles] = useState([])
  const [showNewProject, setShowNewProject] = useState(false)
  const [newForm, setNewForm] = useState({ title: '', recordingDate: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const rawInputRef = useRef(null)
  const finalInputRef = useRef(null)

  const selectedClient = state.clients.find((c) => c.name === selectedClientName)
  const hasDriveFolder = Boolean(selectedClient?.drive_folder_id)

  const STATUS_LABELS = {
    gravado: 'Gravado', brutos_enviados: 'Brutos enviados', em_edicao: 'Em edição',
    revisao: 'Revisão', aprovado: 'Aprovado', publicado: 'Publicado', arquivado: 'Arquivado',
  }
  const STATUS_FLOW = ['gravado','brutos_enviados','em_edicao','revisao','aprovado','publicado','arquivado']
  const statusTone = (s) => ({ gravado:'gold', brutos_enviados:'blue', em_edicao:'blue', revisao:'gold', aprovado:'success', publicado:'success', arquivado:'default' }[s] || 'default')

  useEffect(() => { loadDriveIntegration().then(setDriveConn) }, [])
  useEffect(() => {
    if (!selectedClient?.id) { setProjects([]); return }
    loadVideoProjects(selectedClient.id).then(setProjects)
    setSelectedProject(null); setProjectFiles([])
  }, [selectedClient?.id])
  useEffect(() => {
    if (!selectedProject?.id) { setProjectFiles([]); return }
    loadVideoProjectFiles(selectedProject.id).then(setProjectFiles)
  }, [selectedProject?.id])

  const msg = (text) => setFeedback(text)

  const handleCreateFolder = async () => {
    if (!selectedClient) return
    setBusy(true); msg('Criando pasta no Drive...')
    const res = await drive.createClientFolder(selectedClient.id, selectedClient.name)
    setBusy(false)
    if (res.ok) {
      updateItem('clients', selectedClient.id, { ...selectedClient, drive_folder_id: res.folderId, drive_folder_url: res.folderUrl })
      msg('✅ Pasta criada no Drive!')
    } else msg(`❌ ${res.error}`)
  }

  const handleCreateProject = async () => {
    if (!selectedClient || !newForm.title) return
    setBusy(true); msg('Criando projeto e pastas no Drive...')
    const res = await drive.createVideoProject(selectedClient.id, selectedClient.name, newForm.title, newForm.recordingDate || null, newForm.notes || null)
    setBusy(false)
    if (res.ok) {
      setProjects((prev) => [res.project, ...prev])
      setSelectedProject(res.project)
      setShowNewProject(false)
      setNewForm({ title: '', recordingDate: '', notes: '' })
      msg('✅ Projeto criado: 01-Brutos / 02-Projeto / 03-Final')
    } else msg(`❌ ${res.error}`)
  }

  const doUpload = async (fileList, category) => {
    if (!selectedProject || !fileList?.length) return
    for (const file of Array.from(fileList)) {
      msg(`Preparando ${file.name}...`)
      const folderId = category === 'final' ? selectedProject.final_folder_id : selectedProject.raw_folder_id
      const urlRes = category === 'final'
        ? await drive.getFinalUploadUrl(selectedProject.id, folderId, file.name, file.type)
        : await drive.getRawUploadUrl(selectedProject.id, folderId, file.name, file.type)
      if (!urlRes.ok) { msg(`❌ ${urlRes.error}`); continue }
      msg(`Enviando ${file.name} para o Google Drive...`)
      try {
        const uploadRes = await fetch(urlRes.upload_uri, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })
        if (!uploadRes.ok) throw new Error(`Google Drive HTTP ${uploadRes.status}`)
        const driveFile = await uploadRes.json()
        const saveRes = await drive.saveFile({ videoProjectId: selectedProject.id, driveFileId: driveFile.id, driveFolderId: folderId, fileName: file.name, mimeType: file.type, fileSize: file.size, category })
        if (saveRes.ok) {
          setProjectFiles((prev) => [saveRes.file, ...prev])
          const nextStatus = category === 'final' ? 'revisao' : (selectedProject.status === 'gravado' ? 'brutos_enviados' : selectedProject.status)
          if (nextStatus !== selectedProject.status) {
            setSelectedProject((p) => ({ ...p, status: nextStatus }))
            setProjects((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, status: nextStatus } : p))
          }
          msg(`✅ ${file.name} enviado!`)
        }
      } catch (err) { msg(`❌ Erro: ${err.message}`) }
    }
  }

  const advanceStatus = async (project) => {
    const idx = STATUS_FLOW.indexOf(project.status)
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return
    const next = STATUS_FLOW[idx + 1]
    await updateVideoProject(project.id, { status: next })
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: next } : p))
    if (selectedProject?.id === project.id) setSelectedProject((p) => ({ ...p, status: next }))
    msg(`✅ Status: ${STATUS_LABELS[next]}`)
  }

  const brutos = projectFiles.filter((f) => f.category === 'bruto')
  const finais = projectFiles.filter((f) => f.category === 'final')

  if (driveConn === undefined) return <section className="page-grid"><Panel title="Produção de Vídeo"><p className="muted-note">Carregando...</p></Panel></section>

  if (!driveConn) return (
    <section className="page-grid">
      <Panel title="Google Drive não conectado">
        <p className="muted-note">Conecte sua conta Google para criar pastas por cliente, organizar projetos de vídeo e enviar arquivos diretamente para o Drive.</p>
        <div style={{ marginTop: 12 }}>
          <button className="primary" onClick={() => drive.startAuth()}><HardDrive size={16} /> Conectar Google Drive</button>
        </div>
      </Panel>
    </section>
  )

  return (
    <section className="page-grid">
      <div className="grid-3">
        <MiniStat label="Drive conectado" value={driveConn.google_account_email || '—'} tone="success" />
        <MiniStat label="Projetos do cliente" value={projects.length} tone="blue" />
        <MiniStat label="Arquivos no projeto" value={projectFiles.length} tone="gold" />
      </div>

      <div className="grid-2 align-start">
        <div>
          <Panel title="Cliente">
            <div className="form-grid">
              <Select label="Cliente" value={selectedClientName}
                onChange={(n) => { setSelectedClientName(n); setSelectedProject(null) }}
                options={state.clients.map((c) => c.name)} />
              {selectedClient && !hasDriveFolder && (
                <button className="primary" onClick={handleCreateFolder} disabled={busy}>
                  <FolderOpen size={16} /> Criar pasta no Drive
                </button>
              )}
              {selectedClient?.drive_folder_url && (
                <a href={selectedClient.drive_folder_url} target="_blank" rel="noreferrer"
                  className="secondary" style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                  <ExternalLink size={14} /> Abrir pasta do cliente
                </a>
              )}
              {feedback && <p className="muted-note" style={{ marginTop: 4 }}>{feedback}</p>}
            </div>
          </Panel>

          <Panel title="Projetos de vídeo" action={hasDriveFolder ? '+ Novo' : ''} onAction={() => setShowNewProject(true)}>
            {showNewProject && (
              <div className="form-grid" style={{ marginBottom:16, paddingBottom:16, borderBottom:'1px solid var(--border)' }}>
                <Input label="Título do vídeo" value={newForm.title} onChange={(title) => setNewForm({ ...newForm, title })} />
                <Input label="Data de gravação" type="date" value={newForm.recordingDate} onChange={(recordingDate) => setNewForm({ ...newForm, recordingDate })} />
                <label className="field"><span>Notas</span><textarea className="textarea" value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} /></label>
                <div className="button-row">
                  <button className="primary" onClick={handleCreateProject} disabled={busy || !newForm.title}><Film size={16} /> {busy ? 'Criando...' : 'Criar'}</button>
                  <button className="secondary" onClick={() => setShowNewProject(false)}>Cancelar</button>
                </div>
              </div>
            )}
            {projects.length === 0
              ? <p className="muted-note">{hasDriveFolder ? 'Nenhum projeto. Clique em "+ Novo".' : 'Crie a pasta do cliente primeiro.'}</p>
              : projects.map((p) => (
                  <div key={p.id} className={`list-item${selectedProject?.id === p.id ? ' active' : ''}`} style={{ cursor:'pointer' }} onClick={() => setSelectedProject(p)}>
                    <div>
                      <strong>{p.title}</strong>
                      {p.recording_date && <small> · {p.recording_date}</small>}
                    </div>
                    <div className="button-row compact" style={{ alignItems:'center' }}>
                      <Badge text={STATUS_LABELS[p.status] || p.status} tone={statusTone(p.status)} />
                      {p.drive_folder_url && (
                        <a href={p.drive_folder_url} target="_blank" rel="noreferrer"
                          style={{ color:'var(--accent)', fontSize:12, display:'flex', gap:3 }}
                          onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))
            }
          </Panel>
        </div>

        {selectedProject ? (
          <Panel title={selectedProject.title}>
            <ActionList items={[
              ['Cliente', selectedProject.client_name || '—'],
              ['Status', STATUS_LABELS[selectedProject.status] || selectedProject.status],
              ['Gravação', selectedProject.recording_date || '—'],
            ]} />
            <div className="button-row" style={{ marginTop: 8 }}>
              {selectedProject.drive_folder_url && (
                <a href={selectedProject.drive_folder_url} target="_blank" rel="noreferrer" className="secondary" style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                  <ExternalLink size={14} /> Pasta no Drive
                </a>
              )}
              <button className="secondary" onClick={() => advanceStatus(selectedProject)} disabled={busy}>
                <Check size={14} /> Avançar status
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Brutos ({brutos.length})</h3>
              {brutos.length === 0
                ? <p className="muted-note">Nenhum arquivo bruto enviado.</p>
                : brutos.map((f) => (
                    <div key={f.id} className="list-item" style={{ fontSize:13 }}>
                      <span>{f.file_name}{f.file_size ? ` · ${(f.file_size/1024/1024).toFixed(1)} MB` : ''}</span>
                      {f.file_url && <a href={f.file_url} target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}><ExternalLink size={12} /></a>}
                    </div>
                  ))
              }
              <input ref={rawInputRef} type="file" multiple accept="video/*,image/*,audio/*" style={{ display:'none' }}
                onChange={(e) => doUpload(e.target.files, 'bruto')} />
              <button className="secondary" style={{ marginTop:8 }} onClick={() => rawInputRef.current?.click()} disabled={busy}>
                <UploadCloud size={14} /> Enviar brutos
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Final ({finais.length})</h3>
              {finais.length === 0
                ? <p className="muted-note">Nenhum arquivo final enviado.</p>
                : finais.map((f) => (
                    <div key={f.id} className="list-item" style={{ fontSize:13 }}>
                      <span>{f.file_name}{f.file_size ? ` · ${(f.file_size/1024/1024).toFixed(1)} MB` : ''}</span>
                      {f.file_url && <a href={f.file_url} target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}><ExternalLink size={12} /></a>}
                    </div>
                  ))
              }
              <input ref={finalInputRef} type="file" accept="video/*" style={{ display:'none' }}
                onChange={(e) => doUpload(e.target.files, 'final')} />
              <button className="secondary" style={{ marginTop:8 }} onClick={() => finalInputRef.current?.click()} disabled={busy}>
                <UploadCloud size={14} /> Enviar final
              </button>
            </div>
          </Panel>
        ) : (
          <Panel title="Selecione um projeto">
            <p className="muted-note">Selecione um projeto de vídeo ao lado para ver detalhes, enviar arquivos e avançar o status.</p>
          </Panel>
        )}
      </div>
    </section>
  )
}

function Integracoes() {
  const [waState, setWaState] = useState('—')
  const [qr, setQr] = useState('')
  const [busy, setBusy] = useState(false)
  const [igAccounts, setIgAccounts] = useState(null)
  const [igMsg, setIgMsg] = useState('')
  const [driveConn, setDriveConn] = useState(null)
  const [driveMsg, setDriveMsg] = useState('')

  useEffect(() => {
    loadDriveIntegration().then(setDriveConn)
    // Mostra feedback do callback OAuth se houver parâmetros na URL
    const params = new URLSearchParams(window.location.search)
    const ds = params.get('drive_status')
    const dm = params.get('msg')
    if (ds) setDriveMsg(ds === 'ok' ? `✅ ${decodeURIComponent(dm || 'Conectado!')}` : `❌ ${decodeURIComponent(dm || 'Erro')}`)
  }, [])

  const checkWa = async () => {
    setBusy(true)
    const res = await whatsapp.status()
    setBusy(false)
    setWaState(res.ok ? (res.state || 'desconhecido') : `erro: ${res.error}`)
  }
  const connectWa = async () => {
    setBusy(true); setQr('')
    const res = await whatsapp.connect()
    setBusy(false)
    if (res.ok && res.qr) setQr(res.qr.startsWith('data:') ? res.qr : `data:image/png;base64,${res.qr}`)
    else if (res.ok) { setWaState('open'); setQr('') }
    else setWaState(`erro: ${res.error}`)
  }
  const checkMeta = async () => {
    setIgMsg('Buscando contas...')
    const res = await meta.insights()
    if (res.ok) { setIgAccounts(res.accounts || []); setIgMsg('') }
    else { setIgMsg(`Erro: ${res.error}`); setIgAccounts(null) }
  }

  const items = [
    ['Supabase', 'Banco de dados na nuvem (clientes, leads, roteiros, financeiro...)', isSupabaseConfigured ? 'Conectado' : 'Local', isSupabaseConfigured ? 'success' : 'gold'],
    ['Google Drive', 'Pastas por cliente, projetos de vídeo, upload de brutos e finais', driveConn ? driveConn.google_account_email : 'Desconectado', driveConn ? 'success' : 'gold'],
    ['OpenRouter (Deby AI)', 'Geração de roteiros, legendas e análises', 'Servidor', 'blue'],
    ['Meta/Instagram', 'Contas, insights e publicação', 'Servidor', 'blue'],
    ['WhatsApp / Evolution', 'Envio e recebimento de mensagens', waState, waState === 'open' ? 'success' : 'gold'],
  ]
  return (
    <section className="page-grid">
      <div className="cards-grid">
        {items.map(([title, desc, badge, tone]) => (
          <article className="integration-card" key={title}>
            <div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
            <Badge text={badge} tone={tone} />
          </article>
        ))}
      </div>

      <div className="grid-2 align-start">
        <Panel title="Google Drive (produção de vídeo)">
          {driveConn ? (
            <>
              <p className="muted-note">Conectado como <strong>{driveConn.google_account_email}</strong>.</p>
              <p className="muted-note">Pasta raiz: <code>1-rHJ3bfsx4mvG6xXTpKiCtn1a1_R1Gg0</code></p>
              <div className="button-row" style={{ marginTop: 8 }}>
                <button className="secondary" onClick={() => drive.startAuth()}><RefreshCw size={16} /> Reconectar</button>
              </div>
            </>
          ) : (
            <>
              <p className="muted-note">Conecte uma conta Google para organizar a produção de vídeos por cliente. O acesso é limitado ao escopo <code>drive.file</code> — apenas arquivos criados pelo app.</p>
              <p className="muted-note" style={{ color: 'var(--warning, #f59e0b)', marginTop: 4 }}>⚠️ Certifique-se de configurar <strong>GOOGLE_CLIENT_SECRET</strong> nas variáveis de ambiente da Netlify antes de conectar.</p>
              <button className="primary" style={{ marginTop: 8 }} onClick={() => drive.startAuth()}>
                <HardDrive size={16} /> Conectar Google Drive
              </button>
            </>
          )}
          {driveMsg && <p className="muted-note" style={{ marginTop: 8 }}>{driveMsg}</p>}
        </Panel>

        <Panel title="Conectar WhatsApp">
          <p className="muted-note">Clique em conectar e escaneie o QR code com o WhatsApp do número da agência (Aparelhos conectados).</p>
          <div className="button-row">
            <button className="secondary" onClick={checkWa} disabled={busy}><RefreshCw size={16} /> Verificar status</button>
            <button className="primary" onClick={connectWa} disabled={busy}><MessageCircle size={16} /> {busy ? 'Aguarde...' : 'Conectar / QR'}</button>
          </div>
          <p className="muted-note">Status atual: <strong>{waState}</strong></p>
          {qr && <img src={qr} alt="QR Code WhatsApp" style={{ width: 240, height: 240, marginTop: 12, borderRadius: 12, background: '#fff', padding: 8 }} />}
        </Panel>
      </div>

      <Panel title="Meta / Instagram">
        <p className="muted-note">Lista as contas do Instagram disponíveis no token configurado.</p>
        <button className="secondary" onClick={checkMeta}><Camera size={16} /> Buscar contas</button>
        {igMsg && <p className="muted-note">{igMsg}</p>}
        {igAccounts && (
          <div className="stack-list" style={{ marginTop: 12 }}>
            {igAccounts.length ? igAccounts.map((a) => (
              <ListItem key={a.id} title={a.name} meta={a.instagram_business_account ? `IG: @${a.instagram_business_account.username} · ${a.instagram_business_account.followers_count || 0} seguidores` : 'Sem conta IG vinculada'} badge={a.instagram_business_account ? 'IG' : 'Página'} />
            )) : <div className="empty-box">Nenhuma página/conta encontrada no token.</div>}
          </div>
        )}
      </Panel>

      <Panel title="Checklist para deploy (Netlify)">
        <ActionList
          items={[
            ['Supabase', isSupabaseConfigured ? 'Conectado ao projeto DBE-flow ✅' : 'Preencher VITE_SUPABASE_* no .env'],
            ['Google Drive', driveConn ? `Conectado: ${driveConn.google_account_email} ✅` : 'Configurar GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET na Netlify e conectar'],
            ['WhatsApp webhook', 'Apontar instância Evolution para /api/whatsapp-webhook do site'],
            ['Instagram', 'Confirmar token de acesso e conta IG business vinculada'],
            ['OAUTH_STATE_SECRET', 'Gerar string aleatória e configurar na Netlify (segurança OAuth)'],
          ]}
        />
      </Panel>
    </section>
  )
}

function Panel({ title, action, onAction, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {action && <button className="ghost" onClick={onAction}>{action}</button>}
      </div>
      {children}
    </section>
  )
}

function Modal({ title, open, onClose, children }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-panel">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

function MiniStat({ label, value, tone = 'blue' }) {
  return (
    <div className={`mini-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  const normalized = options.map((option) => typeof option === 'string' ? { label: option, value: option } : option)
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function Badge({ text, tone = 'default' }) {
  return <span className={`badge ${tone}`}>{text}</span>
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, idx) => <td key={idx}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function Pipeline({ leads }) {
  const stages = ['Novo', 'Contato', 'Reunião', 'Proposta', 'Contrato']
  return (
    <div className="pipeline">
      {stages.map((stage) => {
        const count = leads.filter((lead) => lead.status === stage).length
        return <div key={stage}><span>{stage}</span><strong>{count}</strong><i style={{ width: `${Math.max(12, count * 32)}%` }} /></div>
      })}
    </div>
  )
}

function Timeline({ posts }) {
  return <div className="stack-list">{posts.map((post) => <ListItem key={post.id} title={post.caption} meta={`${post.client} · ${dateTime(post.date)} · ${post.network}`} badge={post.status} />)}</div>
}

function ListItem({ title, meta, badge }) {
  return (
    <article className="list-item">
      <div><strong>{title}</strong><span>{meta}</span></div>
      <Badge text={badge} tone={badge === 'Pago' || badge === 'Aprovado' || badge === 'Pronto' ? 'success' : 'gold'} />
    </article>
  )
}

function ActionList({ items, compact = false }) {
  return (
    <div className={compact ? 'action-list compact' : 'action-list'}>
      {items.map(([title, meta]) => (
        <div key={`${title}-${meta}`}>
          <Check size={compact ? 13 : 15} />
          <span>{title}</span>
          <small>{meta}</small>
        </div>
      ))}
    </div>
  )
}

function Progress({ value }) {
  return <div className="progress"><span style={{ width: `${Math.min(100, value)}%` }} /><strong>{value}%</strong></div>
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'DB'
}

function date(value) {
  return value ? format(new Date(`${value}T12:00:00`), 'dd/MM/yyyy') : '-'
}

function dateTime(value) {
  return value ? format(new Date(value), 'dd/MM HH:mm') : '-'
}

function copyText(text) {
  navigator.clipboard?.writeText(text)
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportWorkspace(state) {
  downloadText(`dbe-flow-export-${Date.now()}.json`, JSON.stringify(state, null, 2))
}

function calculateDiagnosticScore(data) {
  return Math.min(100, Math.round(
    (Number(data.ticket) * Number(data.patients)) / 650 +
    (data.agenda === 'Buracos frequentes' ? 22 : data.agenda === 'Oscila' ? 14 : 6) +
    (data.valuePerception === 'Desvalorizado' ? 18 : data.valuePerception === 'Convênio dita valor' ? 14 : 6) +
    (data.social === 'Posta pouco' ? 18 : data.social === 'Posta toda semana' ? 10 : 4) +
    (data.camera === 'Trava para gravar' ? 12 : data.camera === 'Não grava' ? 18 : 4) +
    (data.paid === 'Não investe' ? 12 : 5)
  ))
}

function calculateDiagnosticLoss(data, score) {
  return Math.round(Number(data.ticket || 0) * Number(data.patients || 0) * (score > 70 ? 0.38 : 0.24))
}

function calculateDiagnosticProjection(data) {
  return Math.round((Number(data.ticket || 0) * 1.45) * (Number(data.patients || 0) * 1.35))
}

function buildAiOutput(input, state) {
  const client = state.clients[0]
  return `Diagnóstico Deby AI\n\nContexto recebido:\n${input}\n\nLeitura estratégica:\n- O conteúdo precisa vender percepção antes de vender serviço.\n- A promessa deve ser substituída por critério, bastidor e clareza de processo.\n- O CTA deve pedir uma ação simples, mensurável e segura.\n\nEstrutura sugerida:\n1. Gancho: exponha a tensão principal em uma frase direta.\n2. Dor: conecte a trava operacional com perda de autoridade percebida.\n3. Prova: cite bastidor, método ou critério clínico sem prometer resultado.\n4. CTA: convide para diagnóstico, reunião ou comentário específico.\n\nRoteiro base:\n"Se você é médico e sente que sabe muito mais do que comunica, talvez o problema não seja falta de conteúdo. É falta de direção."\n\nDesenvolvimento:\nMostre que autoridade digital não é falar mais alto, é organizar a mensagem para que o paciente entenda valor, segurança e próximo passo antes da consulta.\n\nCTA:\nSe você quer transformar conhecimento técnico em comunicação que o paciente entende, comece pelo diagnóstico do seu posicionamento.\n\nCliente de referência: ${client?.name || 'Cliente DBE'}\nPilar recomendado: Autoridade + prova de método\nPróxima ação: transformar em roteiro e enviar para aprovação.`
}

function nextFrom(list, current) {
  return list[Math.min(list.indexOf(current) + 1, list.length - 1)] || current
}

function openWhatsApp(phone, message) {
  const target = phone ? phone.replace(/\D/g, '') : ''
  window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`, '_blank')
}

function leadMessage(lead) {
  return `Olá ${lead.name}, aqui é da DBE.\n\nVi seu diagnóstico e existe uma oportunidade clara em ${lead.specialty || 'posicionamento'}: organizar conteúdo, autoridade e previsibilidade comercial.\n\nSeu próximo passo sugerido é: ${lead.next || 'marcar uma reunião rápida'}.\n\nPodemos conversar?`
}

function leadBrief(lead) {
  return `Lead: ${lead.name}\nEspecialidade: ${lead.specialty}\nOrigem: ${lead.source}\nTemperatura: ${lead.temp}\nStatus: ${lead.status}\nValor potencial: ${money(lead.value)}\nPróximo passo: ${lead.next}\nNotas: ${lead.notes || '-'}`
}

function diagnosticSummary(data, score, loss, projected) {
  return `LAUDO DBE - DIAGNÓSTICO DE POSICIONAMENTO\n\nLead: ${data.name || 'A preencher'}\nEspecialidade: ${data.specialty || 'A preencher'}\nScore comercial: ${score}/100\n\nFaturamento atual estimado: ${money(Number(data.ticket) * Number(data.patients))}/mês\nPerda mensal estimada: ${money(loss)}\nPotencial reposicionado: ${money(projected)}/mês\n\nSinais observados:\n- Agenda: ${data.agenda}\n- Percepção de valor: ${data.valuePerception}\n- Conteúdo: ${data.social}\n- Câmera: ${data.camera}\n- Tráfego pago: ${data.paid}\n- Convênios/mês: ${data.convenios}\n\nTese comercial:\nO gargalo não parece ser capacidade técnica. O ponto central é transformar autoridade clínica em percepção de valor antes da consulta, usando conteúdo, prova de método e uma jornada de decisão mais clara.`
}

function suggestScript(pillar, client) {
  const map = {
    Autoridade: ['O sinal que o paciente ignora antes de procurar ajuda', 'Se o paciente só entende valor depois da consulta, sua comunicação chegou tarde.', 'Explique o erro comum, mostre o critério técnico e conecte com prevenção.', 'Salve este conteúdo para lembrar quando esse sinal aparecer.'],
    Educação: ['O que ninguém te explica sobre esse sintoma', 'Nem todo sintoma significa urgência, mas todo sinal repetido merece contexto.', 'Traga 3 critérios simples de observação e oriente avaliação quando necessário.', 'Envie para alguém que vive adiando esse cuidado.'],
    'Prova de método': ['Bastidores de uma decisão segura', 'Antes de qualquer conduta, existe uma sequência de avaliação.', 'Mostre etapas, perguntas e critérios sem prometer resultado.', 'Comente "método" para entender como esse processo funciona.'],
    Oferta: ['Quando faz sentido buscar ajuda especializada?', 'O melhor momento de agir geralmente é antes do problema limitar sua rotina.', 'Mostre para quem é, para quem não é e qual o próximo passo.', 'Clique no link e agende uma avaliação.'],
    Bastidores: ['O que acontece antes do paciente entrar na sala', 'O bastidor revela o cuidado que o feed geralmente não mostra.', 'Mostre preparação, análise ou rotina da equipe.', 'Acompanhe para ver mais bastidores reais.'],
  }
  const [title, hook, body, cta] = map[pillar] || map.Autoridade
  return { title: `${title} - ${client}`, hook, body, cta }
}

function buildScriptDraft(script) {
  return `ROTEIRO DBE\n\nTítulo: ${script.title || 'Sem título'}\nCliente: ${script.client || '-'}\nPilar: ${script.pillar || '-'}\n\nGancho:\n${script.hook || '-'}\n\nDesenvolvimento:\n${script.body || '-'}\n\nCTA:\n${script.cta || '-'}`
}

function generateCaption(client) {
  return `Muitas decisões importantes na saúde começam antes da consulta: começam quando o paciente entende o que deve observar, quando procurar ajuda e quais critérios importam.\n\nNo conteúdo de hoje, ${client || 'a DBE'} mostra um bastidor de orientação com responsabilidade, sem promessa e com foco em clareza.\n\nSalve este post para consultar depois.`
}

function approvalMessage(post) {
  return `Olá! Segue conteúdo para revisão:\n\nCliente: ${post.client}\nRede: ${post.network}\nData: ${dateTime(post.date)}\n\nLegenda:\n${post.caption}\n\nPode aprovar ou pedir ajustes por aqui.`
}

function conversationTemplate(type, lead) {
  if (type === 'Aprovação') return `Olá ${lead?.name || 'cliente'}, passando para aprovação do conteúdo.\n\nVocê pode responder com "aprovado" ou enviar os ajustes que deseja.`
  if (type === 'Cobrança') return `Olá ${lead?.name || 'cliente'}, tudo bem?\n\nPassando para lembrar do vencimento em aberto. Se já tiver realizado o pagamento, pode desconsiderar esta mensagem.`
  if (type === 'Reativação') return `Olá ${lead?.name || 'cliente'}, aqui é da DBE.\n\nRetomando nosso contato: ainda faz sentido conversarmos sobre posicionamento, conteúdo e previsibilidade comercial?`
  return lead ? leadMessage(lead) : 'Olá, aqui é da DBE. Podemos conversar sobre seu diagnóstico?'
}

function invoiceMessage(invoice) {
  return `Olá ${invoice.client}, tudo bem?\n\nPassando para lembrar da cobrança DBE com vencimento em ${date(invoice.due)}, no valor de ${money(invoice.value)}.\n\nSe já tiver realizado, pode desconsiderar.`
}

createRoot(document.getElementById('root')).render(<App />)
