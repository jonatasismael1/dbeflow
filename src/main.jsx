import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  BadgeDollarSign,
  Bot,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  Film,
  Filter,
  FolderOpen,
  Gauge,
  HardDrive,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  MonitorPlay,
  Moon,
  Pause,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Smile,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  UploadCloud,
  User,
  UserPlus,
  Users,
  WalletCards,
  Wand2,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import './styles.css'
import logo from './assets/logo-dbe.png'
import { importedClients, importedScripts } from './data/importedData.js'
import { isSupabaseConfigured } from './lib/supabase'
import { loadAll, insertItem, saveItem, deleteItem, loadConversations, loadMessages, loadVideoProjects, loadVideoProjectFiles, loadDriveIntegration, updateVideoProject } from './lib/db'
import { whatsapp, meta, ai, contract, drive } from './lib/api'

const STORAGE_KEY = 'dbe-flow-state-v2' // v2 = dados reais importados do Notion
const AUTH_KEY = 'dbe-auth-v1'
const MEMBERS_KEY = 'dbe-members'
const THEME_KEY = 'dbe-theme-v1'
const TOAST_EVENT = 'dbe-flow-toast'
const AVATAR_MAX_FILE_SIZE = 8 * 1024 * 1024
const AVATAR_OUTPUT_SIZE = 320

const USERS = [
  { email: 'assessoriadbe@gmail.com', name: 'DBE Digital', role: 'admin', avatar: null },
  { email: 'thayaneluise@gmail.com', name: 'Thayane', role: 'admin', avatar: null },
  { email: 'jonatas.ismael25@gmail.com', name: 'Jonatas', role: 'admin', avatar: null },
]
const AUTH_PASS = 'Db3digit@l'

const ENTITY_LABELS = {
  clients: 'Cliente',
  leads: 'Lead',
  scripts: 'Conteudo',
  posts: 'Post',
  invoices: 'Cobranca',
  automations: 'Automacao',
  contracts: 'Contrato',
  diagnostics: 'Diagnostico',
  briefings: 'Jornada',
}

function notify(message, tone = 'success') {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, tone } }))
}

function mutationNotice(action, key, patch = {}) {
  const label = ENTITY_LABELS[key] || 'Registro'
  if (action === 'create') return `${label} criado com sucesso.`
  if (action === 'delete') return `${label} excluido com sucesso.`
  if (patch.status) {
    const normalized = String(patch.status).toLowerCase()
    if (normalized.includes('aprov')) return `${label} aprovado com sucesso.`
    if (normalized.includes('pago')) return `${label} marcado como pago.`
    if (normalized.includes('postado') || normalized.includes('publicado')) return `${label} publicado com sucesso.`
    return `${label} atualizado para ${patch.status}.`
  }
  return `${label} salvo com sucesso.`
}

function readStoredMembers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MEMBERS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getTeamMembers() {
  const byEmail = new Map(USERS.map((user) => [user.email.toLowerCase(), { ...user }]))
  readStoredMembers().forEach((member) => {
    if (!member?.email) return
    const key = member.email.toLowerCase()
    byEmail.set(key, { ...(byEmail.get(key) || {}), ...member })
  })
  return Array.from(byEmail.values())
}

function persistTeamMembers(members) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members))
}

function resizeAvatarFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo de imagem invalido.'))
      img.onload = () => {
        const sourceSize = Math.min(img.width, img.height)
        const sourceX = Math.max(0, (img.width - sourceSize) / 2)
        const sourceY = Math.max(0, (img.height - sourceSize) / 2)
        const canvas = document.createElement('canvas')
        canvas.width = AVATAR_OUTPUT_SIZE
        canvas.height = AVATAR_OUTPUT_SIZE
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Nao foi possivel preparar a imagem.'))
          return
        }
        ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE)
        resolve(canvas.toDataURL('image/jpeg', 0.86))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
// Abas visíveis para editores
const EDITOR_TABS = new Set(['cronograma', 'calendario', 'teleprompter', 'producao', 'ai', 'configuracoes'])
const CONTENT_FORMATS = ['Reels', 'Roteiro de Reels', 'Post estático', 'Carrossel', 'Stories', 'Legenda', 'Ideia solta', 'Campanha', 'Outro']
const CONTENT_STATUSES = ['Ideia', 'A produzir', 'Em produção', 'Roteiro pronto', 'Arte em criação', 'Aprovando', 'Aprovado', 'Postado', 'Pausado', 'Cancelado']
const CONTENT_PRIORITIES = ['Baixa', 'Média', 'Alta', 'Urgente']

const nav = [
  { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'cronograma',   label: 'Cronograma',   icon: CalendarDays },
  { id: 'calendario',   label: 'Calendário',   icon: Calendar },
  { id: 'teleprompter', label: 'Teleprompter', icon: MonitorPlay },
  { id: 'producao',     label: 'Produção',     icon: Film },
  { id: 'clientes',     label: 'Clientes',     icon: Users },
  { id: 'conversas',    label: 'Conversas',    icon: MessageCircle },
  { id: 'instagram',    label: 'Instagram',    icon: Camera },
  { id: 'financeiro',   label: 'Financeiro',   icon: WalletCards },
  { id: 'crm',          label: 'CRM',          icon: Target },
  { id: 'onboarding',   label: 'Onboarding',   icon: ClipboardCheck },
  { id: 'diagnostico',  label: 'Diagnóstico',  icon: Gauge },
  { id: 'ai',           label: 'Deby AI',      icon: Sparkles },
  { id: 'contratos',      label: 'Contratos',      icon: FileSignature },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
]

const MOBILE_NAV = ['cronograma', 'calendario', 'financeiro', 'conversas']

const pageDescriptions = {
  dashboard: 'Visao executiva da operacao, receita e proximas prioridades.',
  cronograma: 'Planejamento de conteudo por cliente, formato e status.',
  calendario: 'Agenda editorial para edicao, capa e postagem.',
  teleprompter: 'Leitura guiada para gravacoes e roteiros aprovados.',
  producao: 'Pastas, projetos e revisoes de video no Google Drive.',
  clientes: 'Carteira ativa, dados operacionais e historico de cada cliente.',
  conversas: 'Central de relacionamento e respostas pelo WhatsApp.',
  instagram: 'Indicadores de performance e leitura de conteudos publicados.',
  financeiro: 'Receitas, despesas, contas e resultado mensal.',
  crm: 'Pipeline comercial e leads em acompanhamento.',
  onboarding: 'Jornadas, pendencias e progresso de novos clientes.',
  diagnostico: 'Raio-X de posicionamento e oportunidades comerciais.',
  ai: 'Assistente para ideias, respostas e apoio operacional.',
  contratos: 'Geracao e envio de contratos oficiais DBE.',
  configuracoes: 'Preferencias, equipe, integracoes e tema visual.',
}

const seed = {
  clients: importedClients,
  leads: [],
  scripts: importedScripts,
  posts: [],
  invoices: [],
  automations: [
    { id: 'a1', name: 'Lead quente do diagnóstico', channel: 'Conversas WhatsApp', status: 'Pronto', trigger: 'Novo lead com score acima de 70' },
    { id: 'a2', name: 'Aprovação de post', channel: 'WhatsApp + link', status: 'Rascunho', trigger: 'Post movido para revisão' },
    { id: 'a3', name: 'Cobrança amigável', channel: 'Conversas WhatsApp', status: 'Pronto', trigger: 'Fatura vence em 2 dias' },
  ],
  contracts: [],
  diagnostics: [],
  briefings: [],
  cronograma: [],
}

function App() {
  const [active, setActive] = useState('dashboard')
  const [state, setState] = useState(seed)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) } catch { return null }
  })
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [finSummary, setFinSummary] = useState(null)
  const isPublicDiagnostic = new URLSearchParams(window.location.search).get('diagnostico') === 'publico'

  // Aplica o tema ao documento
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  // Carrega resumo financeiro para o Dashboard (usa mês atual, igual ao Controle Mensal)
  useEffect(() => {
    fetch(`${FIN_API}?action=read_all`)
      .then(r => r.json())
      .then(result => {
        if (!result.success) return
        const raw = result.transactions || []
        const { monthlyStats } = finProcess(raw)
        if (monthlyStats.length) {
          const now = new Date()
          const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          const target = monthlyStats.find(m => m.key === curKey) || monthlyStats[monthlyStats.length - 1]
          const recPend = (result.receivables || []).reduce((s, r) => s + Number(r.valor || 0), 0)
          setFinSummary({
            mrr: target.rec,
            expenses: Math.abs(target.desp),
            balance: target.resultado,
            receivables: recPend,
            month: target.label,
          })
        }
      })
      .catch(() => {})
  }, [])

  const login = (user) => {
    setCurrentUser(user)
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    // Editores só têm acesso às abas restritas
    if (user.role !== 'admin') setActive('cronograma')
  }
  const updateCurrentUser = (user) => {
    setCurrentUser(user)
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  }
  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem(AUTH_KEY)
  }

  // Lida com redirect do callback OAuth do Google Drive
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab && nav.some((item) => item.id === tab)) {
      setActive(tab)
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
    notify(mutationNotice('create', key), 'success')
    return record
  }
  // Atualiza: aplica patch local + salva o registro completo no banco
  const updateItem = (key, id, patch) => {
    const current = (state[key] || []).find((item) => item.id === id) || {}
    const merged = { ...current, ...patch }
    setState((cur) => ({ ...cur, [key]: cur[key].map((item) => item.id === id ? merged : item) }))
    saveItem(key, id, merged)
    notify(mutationNotice('update', key, patch), patch.status?.toLowerCase?.().includes('atras') ? 'warning' : 'success')
  }
  // Remove: tira do estado + apaga no banco
  const removeItem = (key, id) => {
    setState((cur) => ({ ...cur, [key]: cur[key].filter((item) => item.id !== id) }))
    deleteItem(key, id)
    notify(mutationNotice('delete', key), 'danger')
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

  const [drawerOpen, setDrawerOpen] = useState(false)

  const navigate = (id) => { setActive(id); setDrawerOpen(false) }

  if (isPublicDiagnostic) {
    return <PublicDiagnosticPage onSubmit={addDiagnosticSubmission} />
  }

  if (!currentUser) {
    return <LoginPage onLogin={login} />
  }

  const isAdmin = currentUser?.role === 'admin'
  const visibleNav = isAdmin ? nav : nav.filter(item => EDITOR_TABS.has(item.id))
  const activeLabel = visibleNav.find((item) => item.id === active)?.label || 'DBE Flow'
  const activeDescription = pageDescriptions[active] || 'Sistema operacional da agencia DBE.'

  return (
    <div className="app-shell">
      <ToastViewport />
      {/* Sidebar hover-expand — desktop */}
      <aside className="sidebar">
        <div className="brand">
          <img src={logo} alt="DBE" />
          <div>
            <strong>DBE Flow</strong>
            <span>Marketing OS</span>
          </div>
        </div>
        <nav>
          {visibleNav.map((item) => (
            <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="mobile-top-bar">
        <img src={logo} alt="DBE" />
        <span className="mobile-top-title">{activeLabel}</span>
        <button className="mobile-menu-btn" onClick={() => setDrawerOpen(true)}><Menu size={20} /></button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && <>
        <div className="mobile-drawer-overlay" onClick={() => setDrawerOpen(false)} />
        <div className="mobile-drawer">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <strong>Menu</strong>
            <button style={{background:'transparent',border:0,color:'var(--muted)',cursor:'pointer'}} onClick={() => setDrawerOpen(false)}><X size={18} /></button>
          </div>
          {visibleNav.map((item) => (
            <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>
      </>}

      <main>
        <header className="topbar">
          <div className="topbar-title">
            <p className="eyebrow">DBE Flow</p>
            <h1>{active === 'dashboard' ? 'Dashboard' : activeLabel}</h1>
            <p className="topbar-subtitle">{activeDescription}</p>
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
            <button className="icon-btn" title={`${currentUser?.name} — Sair`} onClick={logout} style={{marginLeft:4}}>
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {active === 'dashboard' && <Dashboard state={state} metrics={metrics} setActive={navigate} finSummary={finSummary} />}
        {active === 'clientes' && <Clientes state={state} addItem={addItem} updateItem={updateItem} query={query} />}
        {active === 'crm' && <Crm state={state} addItem={addItem} updateItem={updateItem} removeItem={removeItem} query={query} />}
        {active === 'diagnostico' && <Diagnostico state={state} addDiagnosticSubmission={addDiagnosticSubmission} />}
        {active === 'onboarding' && <Onboarding state={state} addItem={addItem} updateItem={updateItem} />}
        {active === 'contratos' && <Contratos state={state} addItem={addItem} updateItem={updateItem} />}
        {active === 'conteudo' && <Conteudo state={state} addItem={addItem} updateItem={updateItem} />}
        {active === 'cronograma' && <CronogramaConteudo state={state} addItem={addItem} updateItem={updateItem} />}
        {active === 'calendario' && <Calendario state={state} />}
        {active === 'teleprompter' && <Teleprompter state={state} />}
        {active === 'ai' && <DebyAI state={state} addItem={addItem} updateItem={updateItem} />}
        {active === 'instagram' && <InstagramAnalytics state={state} currentUser={currentUser} />}
        {active === 'conversas' && <Conversas state={state} addItem={addItem} />}
        {active === 'producao' && <ProducaoVideo state={state} updateItem={updateItem} />}
        {active === 'financeiro' && <FinanceiroCompleto />}
        {active === 'configuracoes' && <Configuracoes currentUser={currentUser} onProfileUpdate={updateCurrentUser} onLogout={logout} theme={theme} setTheme={setTheme} />}
      </main>

      {/* Mobile bottom nav — 4 botões principais (filtrados por role) */}
      <nav className="mobile-bottom-nav">
        {MOBILE_NAV.filter(id => isAdmin || EDITOR_TABS.has(id)).map((id) => {
          const item = nav.find((n) => n.id === id)
          if (!item) return null
          return (
            <button key={id} className={active === id ? 'active' : ''} onClick={() => navigate(id)}>
              <item.icon size={22} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function ToastViewport() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const onToast = (event) => {
      const toast = {
        id: crypto.randomUUID(),
        tone: event.detail?.tone || 'success',
        message: event.detail?.message || 'Atualizado com sucesso.',
      }
      setToasts((current) => [toast, ...current].slice(0, 4))
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id))
      }, 4200)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  if (!toasts.length) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone}`}>
          <span className="toast-icon">{toast.tone === 'danger' ? <X size={16} /> : <Check size={16} />}</span>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Fechar aviso">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const members = getTeamMembers()
    const teamUser = members.find(u => u.email.toLowerCase() === email.toLowerCase())
    // Administradores fixos — usam a senha compartilhada
    if (teamUser?.role === 'admin' && pass === AUTH_PASS) { onLogin({ ...teamUser }); return }
    // Editores criados em Configurações — usam senha individual
    if (teamUser?.password && teamUser.password === pass) { onLogin({ ...teamUser }); return }
    setError('E-mail ou senha incorretos')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={logo} alt="DBE" className="login-logo" />
        <h1 className="login-title">DBE Flow</h1>
        <p className="login-sub">Marketing OS da agência DBE</p>
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:16,marginTop:24}}>
          <label className="field">
            <span>E-mail</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus />
          </label>
          <label className="field" style={{position:'relative'}}>
            <span>Senha</span>
            <input
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              required
              style={{paddingRight:40}}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{position:'absolute',right:10,bottom:10,background:'transparent',border:0,color:'var(--muted)',cursor:'pointer',padding:0}}
            >
              {showPass ? <Eye size={16} /> : <Lock size={16} />}
            </button>
          </label>
          {error && <p style={{color:'var(--red)',fontSize:13,margin:0,textAlign:'center'}}>{error}</p>}
          <button type="submit" className="primary" style={{width:'100%',marginTop:4,height:44,fontSize:15}}>
            Entrar
          </button>
        </form>
        <p style={{textAlign:'center',fontSize:12,color:'var(--soft)',marginTop:20}}>
          Acesso exclusivo para a equipe DBE
        </p>
      </div>
    </div>
  )
}

function Dashboard({ state, metrics, setActive, finSummary }) {
  const [statModal, setStatModal] = useState(null) // 'receita' | 'aberto' | 'receber' | 'pendencias'

  const scriptStages = [
    'Ideias', 'Gravados', 'Em edição', 'Editados', 'Revisão',
    'Aprovados', 'Falta agendamento', 'Agendados', 'Reprovados',
  ]
  const artStages = [
    'Ideias aprovadas', 'Faltam fazer', 'Feitas', 'Aprovadas',
    'Falta agendamento', 'Agendados', 'Reprovadas',
  ]

  const rec = finSummary?.mrr ?? metrics.monthly
  const rcvbl = finSummary?.receivables ?? metrics.receivable
  const recLabel = finSummary ? `Receita realizada (${finSummary.month || 'mês atual'})` : 'Receita mensal estimada'
  const rcvblLabel = finSummary ? 'A receber (planilha)' : 'A receber'

  // Faturas em aberto do CRM (substituição do Pipeline)
  const openInvoices = (state.invoices || []).filter(inv => inv.status !== 'Pago')
  const paidInvoices = (state.invoices || []).filter(inv => inv.status === 'Pago')
  const openTotal = openInvoices.reduce((s, inv) => s + Number(inv.value || 0), 0)

  // Pendências de conteúdo (cronograma + posts)
  const allContent = [...(state.cronograma || []), ...(state.posts || [])]
  const pendingContent = allContent.filter(c => ['Revisão', 'Produção', 'Em produção', 'Arte em criação', 'Aprovando'].includes(c.status))

  // Modal detalhes
  const renderStatModal = () => {
    if (!statModal) return null
    let title = '', rows = []
    if (statModal === 'receita') {
      title = `Receitas recebidas`
      rows = paidInvoices.length > 0
        ? paidInvoices.map(inv => [inv.client, money(Number(inv.value || 0)), inv.due ? new Date(inv.due + 'T12:00:00').toLocaleDateString('pt-BR') : '—', inv.status])
        : [[null, null, null, 'Nenhuma fatura paga registrada no CRM']]
    } else if (statModal === 'aberto') {
      title = 'Faturas em aberto'
      rows = openInvoices.length > 0
        ? openInvoices.map(inv => [inv.client, money(Number(inv.value || 0)), inv.due ? new Date(inv.due + 'T12:00:00').toLocaleDateString('pt-BR') : '—', inv.status])
        : [[null, null, null, 'Nenhuma fatura pendente']]
    } else if (statModal === 'receber') {
      title = 'Contas a receber'
      rows = openInvoices.length > 0
        ? openInvoices.map(inv => [inv.client, money(Number(inv.value || 0)), inv.due ? new Date(inv.due + 'T12:00:00').toLocaleDateString('pt-BR') : '—', inv.status])
        : [[null, null, null, 'Sem pendências']]
    } else if (statModal === 'pendencias') {
      title = 'Pendências de conteúdo'
      rows = pendingContent.length > 0
        ? pendingContent.map(c => [c.title || c.caption?.slice(0,40) || '—', c.client || '—', c.status, c.format || ''])
        : [[null, null, null, 'Nenhuma pendência encontrada']]
    }
    return (
      <div className="fin-modal-overlay" onClick={() => setStatModal(null)}>
        <div className="fin-modal" onClick={e => e.stopPropagation()} style={{maxWidth:520}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <h3 style={{margin:0,fontSize:16}}>{title}</h3>
            <button className="icon-btn" onClick={() => setStatModal(null)}><X size={16} /></button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {rows.map((row, i) => (
              row[0] === null
                ? <p key={i} style={{color:'var(--muted)',fontSize:13,textAlign:'center',padding:'12px 0'}}>{row[3]}</p>
                : (
                  <div key={i} className="profile-info-row" style={{flexWrap:'wrap',gap:4}}>
                    <strong style={{flex:2,minWidth:120}}>{row[0]}</strong>
                    <span style={{flex:1,textAlign:'right',color:'var(--green)',fontWeight:600}}>{row[1]}</span>
                    <span style={{flex:1,textAlign:'right',color:'var(--muted)',fontSize:12}}>{row[2]}</span>
                    <span style={{flex:1,textAlign:'right'}}><span className="badge">{row[3]}</span></span>
                  </div>
                )
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Calendário — fonte de dados para o painel de Artes (cronograma + posts)
  const calendarContent = [...(state.cronograma || []), ...(state.posts || [])]

  return (
    <section className="page-grid">
      {renderStatModal()}
      <div className="grid-4">
        <MiniStat label={recLabel} value={money(rec)} tone="success" onClick={() => setStatModal('receita')} />
        <MiniStat label="Faturas em aberto" value={money(openTotal)} tone="gold" onClick={() => setStatModal('aberto')} />
        <MiniStat label={rcvblLabel} value={money(rcvbl)} tone="blue" onClick={() => setStatModal('receber')} />
        <MiniStat label="Pendências de conteúdo" value={pendingContent.length} tone="danger" onClick={() => setStatModal('pendencias')} />
      </div>

      <div className="grid-2">
        <Panel title="Funil comercial" action="Abrir CRM" onAction={() => setActive('crm')}>
          <Pipeline leads={state.leads} />
        </Panel>
        <Panel title="Roteiros" action="Abrir cronograma" onAction={() => setActive('cronograma')}>
          <StatusFunnel stages={scriptStages} counts={countScriptStages(state.scripts, state.posts)} />
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Conteúdo do calendário" action="Abrir calendário" onAction={() => setActive('calendario')}>
          <StatusFunnel stages={artStages} counts={countArtStages(calendarContent)} />
        </Panel>
        <Panel title="Agenda de produção" action="Calendário" onAction={() => setActive('calendario')}>
          <Timeline posts={calendarContent} />
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
              ['Cobranças pendentes', `${openInvoices.length} fatura(s) a acompanhar`],
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
  const [form, setForm] = useState({
    name: '',
    phone: '',
    instagram: '',
    segment: '',
    plan: 'Autoridade Médica',
    status: 'Onboarding',
    monthly: 6200,
    owner: 'DBE',
    next: 'Briefing inicial',
    payment_due: '',
    payment_status: 'A receber',
    billing_contact: '',
    billing_phone: '',
    billing_email: '',
    contract_status: 'Pendente',
    client_origin: 'Manual',
    logo_url: '',
    credentials: '',
    personal_notes: '',
    content_preferences: '',
    recording_preferences: '',
  })
  const clients = state.clients.filter((client) => JSON.stringify(client).toLowerCase().includes(query.toLowerCase()))
  const selected = state.clients.find((client) => client.id === selectedId) || state.clients[0]
  const selectedDiagnostics = (state.diagnostics || []).filter((item) => item.name === selected?.name || item.phone === selected?.phone)
  const selectedInvoices = (state.invoices || []).filter((invoice) => invoice.client_id === selected?.id || invoice.client === selected?.name)
  const [clientDraft, setClientDraft] = useState(selected || {})

  useEffect(() => {
    if (selected) setClientDraft({ ...selected })
  }, [selected?.id])

  const saveClientDetails = () => {
    if (!selected?.id) return
    updateItem('clients', selected.id, clientDraft)
    const latestInvoice = selectedInvoices[0]
    if (latestInvoice && clientDraft.payment_status) {
      updateItem('invoices', latestInvoice.id, {
        ...latestInvoice,
        status: clientDraft.payment_status,
        due: clientDraft.payment_due || latestInvoice.due,
        billing_contact: clientDraft.billing_contact,
        billing_phone: clientDraft.billing_phone,
        billing_email: clientDraft.billing_email,
      })
    }
  }

  const createClientInvoice = () => {
    if (!selected?.id) return
    const due = clientDraft.payment_due || nextPaymentDate(clientDraft.payment_day)
    addItem('invoices', {
      client_id: selected.id,
      client: clientDraft.name || selected.name,
      due,
      value: Number(clientDraft.monthly || selected.monthly || 0),
      status: clientDraft.payment_status || 'A receber',
      billing_contact: clientDraft.billing_contact || '',
      billing_phone: clientDraft.billing_phone || clientDraft.phone || '',
      billing_email: clientDraft.billing_email || '',
    })
    updateItem('clients', selected.id, { ...clientDraft, payment_due: due })
  }

  const markClientPayment = (status) => {
    if (!selected?.id) return
    const nextClient = { ...clientDraft, payment_status: status }
    setClientDraft(nextClient)
    updateItem('clients', selected.id, nextClient)
    const latestInvoice = selectedInvoices[0]
    if (latestInvoice) updateItem('invoices', latestInvoice.id, { ...latestInvoice, status })
  }

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
              <div className="client-sections">
                <section>
                  <h3>Financeiro e cobrança</h3>
                  <div className="form-grid">
                    <Input label="Data de pagamento" type="date" value={clientDraft.payment_due || ''} onChange={(payment_due) => setClientDraft({ ...clientDraft, payment_due })} />
                    <Select label="Status de pagamento" value={clientDraft.payment_status || 'A receber'} onChange={(payment_status) => setClientDraft({ ...clientDraft, payment_status })} options={['A receber', 'Pago', 'Atrasado']} />
                    <Input label="Contato de cobrança" value={clientDraft.billing_contact || ''} onChange={(billing_contact) => setClientDraft({ ...clientDraft, billing_contact })} />
                    <Input label="WhatsApp de cobrança" value={clientDraft.billing_phone || ''} onChange={(billing_phone) => setClientDraft({ ...clientDraft, billing_phone })} />
                    <Input label="E-mail de cobrança" value={clientDraft.billing_email || ''} onChange={(billing_email) => setClientDraft({ ...clientDraft, billing_email })} />
                    <Input label="Mensalidade" type="number" value={clientDraft.monthly || 0} onChange={(monthly) => setClientDraft({ ...clientDraft, monthly })} />
                  </div>
                  <div className="button-row compact">
                    <button className="secondary" onClick={() => markClientPayment('Pago')}><Check size={14} /> Pago</button>
                    <button className="secondary danger-text" onClick={() => markClientPayment('Atrasado')}><Activity size={14} /> Atrasado</button>
                    <button className="secondary" onClick={createClientInvoice}><Plus size={14} /> Criar cobrança</button>
                    <button className="primary" onClick={saveClientDetails}><Check size={14} /> Salvar</button>
                  </div>
                  {selectedInvoices.length ? (
                    <div className="stack-list compact-stack">
                      {selectedInvoices.map((invoice) => (
                        <ListItem key={invoice.id} title={`${date(invoice.due)} · ${money(invoice.value)}`} meta={invoice.billing_contact || invoice.billing_phone || 'Cobrança vinculada ao financeiro'} badge={invoice.status} />
                      ))}
                    </div>
                  ) : <div className="empty-box">Nenhuma cobrança vinculada ainda.</div>}
                </section>

                <section>
                  <h3>Contrato e informações internas</h3>
                  <div className="form-grid">
                    <Select label="Contrato" value={clientDraft.contract_status || 'Pendente'} onChange={(contract_status) => setClientDraft({ ...clientDraft, contract_status })} options={['Pendente', 'Contrato preenchido', 'Sem contrato - confiança', 'Importado/legado']} />
                    <Select label="Origem do cliente" value={clientDraft.client_origin || 'Manual'} onChange={(client_origin) => setClientDraft({ ...clientDraft, client_origin })} options={['Manual', 'Contrato', 'Importado/legado', 'Diagnóstico']} />
                    <Input label="Logo (URL)" value={clientDraft.logo_url || ''} onChange={(logo_url) => setClientDraft({ ...clientDraft, logo_url })} />
                    <Input label="Preferência de gravação" value={clientDraft.recording_preferences || ''} onChange={(recording_preferences) => setClientDraft({ ...clientDraft, recording_preferences })} />
                    <label className="field span">
                      <span>Preferências de conteúdo</span>
                      <textarea className="textarea" value={clientDraft.content_preferences || ''} onChange={(event) => setClientDraft({ ...clientDraft, content_preferences: event.target.value })} />
                    </label>
                    <label className="field span">
                      <span>Senhas e acessos</span>
                      <textarea className="textarea" value={clientDraft.credentials || ''} onChange={(event) => setClientDraft({ ...clientDraft, credentials: event.target.value })} />
                    </label>
                    <label className="field span">
                      <span>Informações pessoais</span>
                      <textarea className="textarea" value={clientDraft.personal_notes || ''} onChange={(event) => setClientDraft({ ...clientDraft, personal_notes: event.target.value })} />
                    </label>
                  </div>
                </section>
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
          <Input label="Data de pagamento" type="date" value={form.payment_due} onChange={(payment_due) => setForm({ ...form, payment_due })} />
          <Select label="Status de pagamento" value={form.payment_status} onChange={(payment_status) => setForm({ ...form, payment_status })} options={['A receber', 'Pago', 'Atrasado']} />
          <Input label="Contato cobrança" value={form.billing_contact} onChange={(billing_contact) => setForm({ ...form, billing_contact })} />
          <Input label="WhatsApp cobrança" value={form.billing_phone} onChange={(billing_phone) => setForm({ ...form, billing_phone })} />
          <Select label="Contrato" value={form.contract_status} onChange={(contract_status) => setForm({ ...form, contract_status })} options={['Pendente', 'Contrato preenchido', 'Sem contrato - confiança', 'Importado/legado']} />
          <Input label="Logo (URL)" value={form.logo_url} onChange={(logo_url) => setForm({ ...form, logo_url })} />
          <label className="field span">
            <span>Preferências de conteúdo e gravação</span>
            <textarea className="textarea" value={`${form.content_preferences || ''}${form.recording_preferences ? `\nGravações: ${form.recording_preferences}` : ''}`} onChange={(event) => setForm({ ...form, content_preferences: event.target.value })} />
          </label>
          <button className="primary span" onClick={async () => {
            if (!form.name) return
            const client = await addItem('clients', form)
            if (form.payment_due) {
              await addItem('invoices', {
                client_id: client.id,
                client: client.name,
                due: form.payment_due,
                value: Number(form.monthly || 0),
                status: form.payment_status || 'A receber',
                billing_contact: form.billing_contact,
                billing_phone: form.billing_phone || form.phone,
                billing_email: form.billing_email,
              })
            }
            setModalOpen(false)
          }}><Plus size={16} /> Salvar cliente</button>
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

  const syncClientFromContract = async () => {
    const due = nextPaymentDate(form.dia_pagamento)
    const existing = state.clients.find((client) => client.name === form.nome || (form.phone && client.phone === form.phone))
    const clientData = {
      name: form.nome,
      phone: form.phone,
      segment: form.descricao_cliente,
      plan: 'Contrato DBE',
      status: 'Ativo',
      monthly: Number(form.valor_parcela || 0),
      owner: 'DBE',
      next: 'Onboarding pós-contrato',
      payment_due: due,
      payment_status: 'A receber',
      billing_phone: form.phone,
      contract_status: 'Contrato preenchido',
      client_origin: 'Contrato',
      content_preferences: `${form.videos_mes} vídeos/mês · ${form.artes_mes} artes/mês`,
    }
    const client = existing
      ? (updateItem('clients', existing.id, { ...existing, ...clientData }), { ...existing, ...clientData, id: existing.id })
      : await addItem('clients', clientData)

    const alreadyHasInvoice = state.invoices.some((invoice) => invoice.client_id === client.id && invoice.due === due)
    if (!alreadyHasInvoice) {
      await addItem('invoices', {
        client_id: client.id,
        client: client.name,
        due,
        value: Number(form.valor_parcela || 0),
        status: 'A receber',
        billing_phone: form.phone,
      })
    }
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
    await syncClientFromContract()
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
  const firstClient = state.clients[0]
  const [form, setForm] = useState({ title: '', client_id: firstClient?.id || '', client: firstClient?.name || '', pillar: 'Autoridade', format: 'Roteiro de Reels', status: 'Ideia', responsible: 'DBE', priority: 'Média', hook: '', body: '', cta: '', caption: '', notes: '', source: 'roteiros' })
  const selectClient = (clientId) => {
    const client = state.clients.find((item) => item.id === clientId)
    setForm({ ...form, client_id: clientId, client: client?.name || form.client })
  }
  const draft = buildScriptDraft(form)
  return (
    <section className="page-grid">
      <Panel title="Novo roteiro">
        <div className="form-grid">
          <Input label="Título" value={form.title} onChange={(title) => setForm({ ...form, title })} />
          <Select label="Cliente" value={form.client_id} onChange={selectClient} options={state.clients.map((c) => ({ label: c.name, value: c.id }))} />
          <Select label="Pilar" value={form.pillar} onChange={(pillar) => setForm({ ...form, pillar })} options={['Autoridade', 'Educação', 'Prova de método', 'Oferta', 'Bastidores']} />
          <Select label="Formato" value={form.format} onChange={(format) => setForm({ ...form, format })} options={CONTENT_FORMATS} />
          <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={CONTENT_STATUSES} />
          <Select label="Prioridade" value={form.priority} onChange={(priority) => setForm({ ...form, priority })} options={CONTENT_PRIORITIES} />
          <Input label="Responsável" value={form.responsible} onChange={(responsible) => setForm({ ...form, responsible })} />
          <Input label="Gancho" value={form.hook} onChange={(hook) => setForm({ ...form, hook })} />
          <label className="field">
            <span>Desenvolvimento</span>
            <textarea className="textarea" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          </label>
          <Input label="CTA" value={form.cta} onChange={(cta) => setForm({ ...form, cta })} />
          <button className="secondary" onClick={() => setForm({ ...form, ...suggestScript(form.pillar, form.client) })}><Wand2 size={16} /> Gerar base</button>
          <button className="secondary" onClick={() => copyText(draft)}><Copy size={16} /> Copiar roteiro</button>
          <button className="primary span" onClick={() => form.title && addItem('scripts', { ...form, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}><Plus size={16} /> Salvar roteiro</button>
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

function CronogramaConteudo({ state, addItem, updateItem }) {
  const [expanded, setExpanded] = useState({})
  const [filters, setFilters] = useState({ query: '', client: 'Todos', format: 'Todos', status: 'Todos', responsible: 'Todos', month: 'Todos', priority: 'Todos', archived: false })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(() => emptyContentForm(state.clients))
  const [driveFeedback, setDriveFeedback] = useState('')
  const [editedVideos, setEditedVideos] = useState([])
  const [selectedEditedVideoId, setSelectedEditedVideoId] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const contentFileInputRef = useRef(null)

  const visibleClients = state.clients.filter((client) => filters.archived || !isArchivedClient(client))
  const allContent = state.scripts.map((item) => normalizeContentItem(item, state.clients))
  const responsibleOptions = unique(['Todos', 'DBE', ...allContent.map((item) => item.responsible).filter(Boolean), ...state.clients.map((client) => client.owner).filter(Boolean)])
  const monthOptions = unique(['Todos', ...allContent.flatMap((item) => [item.delivery_date, item.post_date, item.cover_date]).filter(Boolean).map((value) => value.slice(0, 7))])
  const filteredContent = allContent.filter((item) => contentMatchesFilters(item, filters, state.clients))
  const groups = visibleClients.map((client) => ({
    client,
    items: filteredContent.filter((item) => contentBelongsToClient(item, client)),
  }))

  const openNew = (client) => {
    setEditing(null)
    setForm(emptyContentForm(state.clients, client))
    setDriveFeedback('')
    setEditedVideos([])
    setSelectedEditedVideoId('')
    setReviewNote('')
    setReviewFeedback('')
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({ ...emptyContentForm(state.clients), ...item })
    setDriveFeedback('')
    setEditedVideos([])
    setSelectedEditedVideoId('')
    setReviewNote('')
    setReviewFeedback('')
    setModalOpen(true)
  }

  const saveContent = async () => {
    if (!form.title) return
    const client = state.clients.find((item) => item.id === form.client_id) || state.clients.find((item) => item.name === form.client)
    const now = new Date().toISOString()
    let shouldClose = true
    const payload = {
      ...form,
      client_id: client?.id || form.client_id || '',
      client: client?.name || form.client || '',
      source: form.source || (editing ? editing.source : 'cronograma'),
      updatedAt: now,
    }
    let saved = editing?.id ? { ...payload, id: editing.id } : null
    if (editing?.id) updateItem('scripts', editing.id, payload)
    else saved = await addItem('scripts', { ...payload, createdAt: now })

    if (payload.format === 'Roteiro de Reels' && client?.id && saved?.id) {
      setDriveFeedback('Criando pasta do roteiro no Drive...')
      const folderRes = await drive.createContentFolder(saved.id, client.id, client.name, payload.title)
      if (folderRes.ok) {
        const nextPayload = {
          ...payload,
          drive_folder_id: folderRes.folderId,
          drive_folder_url: folderRes.folderUrl,
          edited_folder_id: folderRes.editedFolderId,
          edited_folder_url: folderRes.editedFolderUrl,
          updatedAt: new Date().toISOString(),
        }
        updateItem('scripts', saved.id, nextPayload)
        setDriveFeedback('Pasta do roteiro criada/vinculada no Drive.')
      } else setDriveFeedback(`Erro ao criar pasta no Drive: ${folderRes.error}`)
      if (!folderRes.ok) shouldClose = false
    }
    if (shouldClose) setModalOpen(false)
  }

  const ensureContentFolder = async () => {
    const client = state.clients.find((item) => item.id === form.client_id) || state.clients.find((item) => item.name === form.client)
    if (!editing?.id || !client?.id || !form.title) return null
    if (form.drive_folder_id && form.edited_folder_id) {
      return {
        folderId: form.drive_folder_id,
        folderUrl: form.drive_folder_url,
        editedFolderId: form.edited_folder_id,
        editedFolderUrl: form.edited_folder_url,
      }
    }
    setDriveFeedback('Criando pasta do roteiro no Drive...')
    const res = await drive.createContentFolder(editing.id, client.id, client.name, form.title)
    if (!res.ok) {
      setDriveFeedback(`Erro ao criar pasta no Drive: ${res.error}`)
      return null
    }
    const patch = {
      ...form,
      drive_folder_id: res.folderId,
      drive_folder_url: res.folderUrl,
      edited_folder_id: res.editedFolderId,
      edited_folder_url: res.editedFolderUrl,
      updatedAt: new Date().toISOString(),
    }
    setForm(patch)
    updateItem('scripts', editing.id, patch)
    setDriveFeedback('Pasta do roteiro pronta no Drive.')
    return res
  }

  const uploadContentFiles = async (fileList) => {
    if (!editing?.id || !fileList?.length) return
    const folder = await ensureContentFolder()
    const folderId = folder?.folderId || form.drive_folder_id
    if (!folderId) return

    const uploaded = []
    for (const file of Array.from(fileList)) {
      setDriveFeedback(`Preparando ${file.name}...`)
      const urlRes = await drive.getContentUploadUrl(editing.id, folderId, file.name, file.type)
      if (!urlRes.ok) { setDriveFeedback(`Erro ao preparar upload: ${urlRes.error}`); continue }
      setDriveFeedback(`Enviando ${file.name} para o Drive...`)
      try {
        const uploadRes = await fetch(urlRes.upload_uri, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })
        if (!uploadRes.ok) throw new Error(`Google Drive HTTP ${uploadRes.status}`)
        const driveFile = await uploadRes.json()
        uploaded.push({
          id: driveFile.id,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          url: `https://drive.google.com/file/d/${driveFile.id}/view`,
          uploadedAt: new Date().toISOString(),
        })
      } catch (err) {
        setDriveFeedback(`Erro ao enviar ${file.name}: ${err.message}`)
      }
    }
    if (uploaded.length) {
      const nextFiles = [...normalizeMediaFiles(form.media_files), ...uploaded]
      const patch = { ...form, media_files: nextFiles, status: form.status === 'Ideia' ? 'A produzir' : form.status, updatedAt: new Date().toISOString() }
      setForm(patch)
      updateItem('scripts', editing.id, patch)
      setDriveFeedback(`${uploaded.length} arquivo(s) enviado(s) para a pasta do roteiro.`)
    }
  }

  const refreshEditedVideos = async () => {
    if (!editing?.id) return
    setReviewLoading(true)
    setReviewFeedback('Buscando vídeos editados no Drive...')
    const folder = await ensureContentFolder()
    if (!folder) {
      setReviewLoading(false)
      return
    }
    const res = await drive.listEditedFiles(editing.id)
    setReviewLoading(false)
    if (!res.ok) {
      setReviewFeedback(`Erro ao buscar vídeos editados: ${res.error}`)
      return
    }
    const files = res.files || []
    setEditedVideos(files)
    const nextSelected = selectedEditedVideoId && files.some((file) => file.id === selectedEditedVideoId)
      ? selectedEditedVideoId
      : files[0]?.id || ''
    setSelectedEditedVideoId(nextSelected)
    const selectedFile = files.find((file) => file.id === nextSelected)
    setReviewNote(getVideoReview(form, nextSelected)?.note || '')
    setReviewFeedback(files.length ? `${files.length} arquivo(s) encontrado(s) em Vídeo editado.` : 'Nenhum vídeo editado encontrado nessa pasta.')
    if (res.folderId && (!form.edited_folder_id || form.edited_folder_id !== res.folderId)) {
      const patch = { ...form, edited_folder_id: res.folderId, edited_folder_url: res.folderUrl, updatedAt: new Date().toISOString() }
      setForm(patch)
      updateItem('scripts', editing.id, patch)
    }
    if (selectedFile) setReviewNote(getVideoReview(form, selectedFile.id)?.note || '')
  }

  const selectEditedVideo = (file) => {
    setSelectedEditedVideoId(file.id)
    setReviewNote(getVideoReview(form, file.id)?.note || '')
    setReviewFeedback('')
  }

  const saveVideoReview = (status) => {
    const file = editedVideos.find((item) => item.id === selectedEditedVideoId) || editedVideos[0]
    if (!editing?.id || !file) return
    const now = new Date().toISOString()
    const reviews = normalizeVideoReviews(form.video_reviews)
    const current = reviews.find((item) => item.fileId === file.id) || {}
    const nextReview = {
      ...current,
      fileId: file.id,
      fileName: file.name,
      fileUrl: file.url,
      previewUrl: file.previewUrl,
      status,
      note: reviewNote,
      updatedAt: now,
      createdAt: current.createdAt || now,
    }
    const nextReviews = [...reviews.filter((item) => item.fileId !== file.id), nextReview]
    const patch = {
      ...form,
      video_reviews: nextReviews,
      approval_status: status === 'approved' ? 'Aprovado' : status === 'changes_requested' ? 'Ajustes solicitados' : 'Comentado',
      approved_video_file_id: status === 'approved' ? file.id : form.approved_video_file_id,
      status: status === 'approved' ? 'Aprovado' : status === 'changes_requested' ? 'Aprovando' : form.status,
      updatedAt: now,
    }
    setForm(patch)
    updateItem('scripts', editing.id, patch)
    setReviewFeedback(status === 'approved' ? 'Vídeo aprovado.' : status === 'changes_requested' ? 'Observações salvas e ajustes solicitados.' : 'Observação salva.')
  }

  const selectedEditedVideo = editedVideos.find((item) => item.id === selectedEditedVideoId) || editedVideos[0]
  const selectedReview = selectedEditedVideo ? getVideoReview(form, selectedEditedVideo.id) : null

  return (
    <section className="page-grid">
      <div className="schedule-top">
        <div>
          <p className="eyebrow">Conteúdo por cliente</p>
          <h2>Cronograma de Conteúdo</h2>
        </div>
        <button className="primary" onClick={() => openNew()}><Plus size={16} /> Novo conteúdo</button>
      </div>

      <Panel title="Filtros rápidos">
        <div className="schedule-filters">
          <label className="search">
            <Search size={16} />
            <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Buscar conteúdo, legenda, referência..." />
          </label>
          <Select label="Cliente" value={filters.client} onChange={(client) => setFilters({ ...filters, client })} options={['Todos', ...state.clients.map((client) => client.name)]} />
          <Select label="Formato" value={filters.format} onChange={(format) => setFilters({ ...filters, format })} options={['Todos', ...CONTENT_FORMATS]} />
          <Select label="Status" value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={['Todos', ...CONTENT_STATUSES]} />
          <Select label="Responsável" value={filters.responsible} onChange={(responsible) => setFilters({ ...filters, responsible })} options={responsibleOptions} />
          <Select label="Mês" value={filters.month} onChange={(month) => setFilters({ ...filters, month })} options={monthOptions.map((month) => month === 'Todos' ? month : { label: formatMonth(month), value: month })} />
          <Select label="Prioridade" value={filters.priority} onChange={(priority) => setFilters({ ...filters, priority })} options={['Todos', ...CONTENT_PRIORITIES]} />
          <button className={filters.archived ? 'secondary active' : 'secondary'} onClick={() => setFilters({ ...filters, archived: !filters.archived })}>Mostrar arquivados</button>
        </div>
      </Panel>

      <div className="schedule-list">
        {groups.map(({ client, items }) => {
          const isOpen = expanded[client.id] ?? true
          return (
            <section className="schedule-group" key={client.id}>
              <div className="group-head">
                <button className="group-toggle" onClick={() => setExpanded({ ...expanded, [client.id]: !isOpen })}>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <div>
                    <strong>{client.name}</strong>
                    <span>{client.segment || client.plan || 'Projeto DBE'}</span>
                  </div>
                </button>
                <Badge text={`${items.length} conteúdo(s)`} tone={items.length ? 'blue' : 'default'} />
                <button className="ghost" onClick={() => openNew(client)}><Plus size={14} /> Adicionar</button>
              </div>
              {isOpen && (
                <div className="group-body">
                  {items.length ? (
                    items.map((item) => (
                      <button className="schedule-row" key={item.id} onClick={() => openEdit(item)}>
                        <div className="content-title-cell">
                          <strong>{item.title}</strong>
                          <span>{item.reference_url || item.caption || item.notes || 'Sem detalhes adicionais'}</span>
                        </div>
                        <Badge text={item.format} tone={formatTone(item.format)} />
                        <Badge text={item.status} tone={statusTone(item.status)} />
                        <span>{item.responsible || '-'}</span>
                        <span>{date(item.delivery_date)}</span>
                        <span>{date(item.post_date)}</span>
                        <Badge text={item.priority} tone={priorityTone(item.priority)} />
                        <span className="attachment-cell">{item.media_files ? <Paperclip size={15} /> : null}</span>
                      </button>
                    ))
                  ) : (
                    <div className="empty-box schedule-empty">
                      <span>Esse cliente ainda não tem conteúdos cadastrados.</span>
                      <button className="secondary" onClick={() => openNew(client)}><Plus size={14} /> Adicionar primeiro conteúdo</button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <Modal title={editing ? 'Editar conteúdo' : 'Novo conteúdo'} open={modalOpen} onClose={() => setModalOpen(false)} wide={form.format === 'Roteiro de Reels'}>
        <div className="content-modal">
          <div className="form-grid">
            <Select label="Cliente / Projeto" value={form.client_id} onChange={(client_id) => {
              const client = state.clients.find((item) => item.id === client_id)
              setForm({ ...form, client_id, client: client?.name || form.client })
            }} options={state.clients.map((client) => ({ label: client.name, value: client.id }))} />
            <Input label="Título do conteúdo" value={form.title || ''} onChange={(title) => setForm({ ...form, title })} />
            <Select label="Formato" value={form.format || 'Roteiro de Reels'} onChange={(format) => setForm({ ...form, format })} options={CONTENT_FORMATS} />
            <Select label="Status" value={form.status || 'Ideia'} onChange={(status) => setForm({ ...form, status })} options={CONTENT_STATUSES} />
            <Input label="Responsável" value={form.responsible || ''} onChange={(responsible) => setForm({ ...form, responsible })} />
            <Select label="Prioridade" value={form.priority || 'Média'} onChange={(priority) => setForm({ ...form, priority })} options={CONTENT_PRIORITIES} />
            <Input label="Data de entrega" type="date" value={form.delivery_date || ''} onChange={(delivery_date) => setForm({ ...form, delivery_date })} />
            <Input label="Data de postagem" type="date" value={form.post_date || ''} onChange={(post_date) => setForm({ ...form, post_date })} />
            <Input label="Data da capa" type="date" value={form.cover_date || ''} onChange={(cover_date) => setForm({ ...form, cover_date })} />
            <Input label="Referência" value={form.reference_url || ''} onChange={(reference_url) => setForm({ ...form, reference_url })} />
            <label className="field span">
              <span>Legenda</span>
              <textarea className="textarea" value={form.caption || ''} onChange={(event) => setForm({ ...form, caption: event.target.value })} />
            </label>
            <label className="field span">
              <span>Arquivos e mídia</span>
              <textarea className="textarea" value={mediaFilesToText(form.media_files)} onChange={(event) => setForm({ ...form, media_files: event.target.value })} placeholder="Cole links do Drive, referências ou nomes de arquivos." />
            </label>
            {form.format === 'Roteiro de Reels' && (
              <>
                <div className="drive-content-tools span">
                  <div>
                    <strong>Pasta do roteiro no Drive</strong>
                    <span>{form.drive_folder_url ? 'Pasta vinculada. Os arquivos enviados entram nela.' : 'Ao salvar, a pasta será criada dentro da pasta do cliente.'}</span>
                  </div>
                  <div className="button-row compact no-margin">
                    {form.drive_folder_url && (
                      <a className="secondary" href={form.drive_folder_url} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} /> Abrir pasta
                      </a>
                    )}
                    {form.edited_folder_url && (
                      <a className="secondary" href={form.edited_folder_url} target="_blank" rel="noreferrer">
                        <Film size={14} /> Vídeo editado
                      </a>
                    )}
                    {editing?.id && (
                      <>
                        <button className="secondary" onClick={ensureContentFolder}><FolderOpen size={14} /> Garantir pasta</button>
                        <button className="primary" onClick={() => contentFileInputRef.current?.click()}><UploadCloud size={14} /> Adicionar arquivos</button>
                        <input ref={contentFileInputRef} type="file" multiple accept="video/*,image/*,audio/*" style={{ display:'none' }} onChange={(event) => uploadContentFiles(event.target.files)} />
                      </>
                    )}
                  </div>
                  {driveFeedback && <p className="muted-note">{driveFeedback}</p>}
                </div>

                {editing?.id && (
                  <div className="video-review-panel span">
                    <div className="review-head">
                      <div>
                        <strong>Revisão do vídeo editado</strong>
                        <span>Player interno, observações e aprovação do arquivo final.</span>
                      </div>
                      <button className="secondary" onClick={refreshEditedVideos} disabled={reviewLoading}>
                        <RefreshCw size={14} /> {reviewLoading ? 'Buscando...' : 'Buscar vídeos'}
                      </button>
                    </div>
                    {editedVideos.length ? (
                      <div className="review-workspace">
                        <div className="review-files">
                          {editedVideos.map((file) => {
                            const review = getVideoReview(form, file.id)
                            return (
                              <button key={file.id} className={selectedEditedVideo?.id === file.id ? 'review-file active' : 'review-file'} onClick={() => selectEditedVideo(file)}>
                                <Film size={15} />
                                <span>
                                  <strong>{file.name}</strong>
                                  <small>{reviewLabel(review?.status) || driveItemMeta(file)}</small>
                                </span>
                              </button>
                            )
                          })}
                        </div>
                        <div className="review-player-wrap">
                          {selectedEditedVideo && (
                            <>
                              <div className="review-player">
                                <iframe title={selectedEditedVideo.name} src={selectedEditedVideo.previewUrl} allow="autoplay; fullscreen; encrypted-media" allowFullScreen />
                              </div>
                              <div className="review-meta">
                                <strong>{selectedEditedVideo.name}</strong>
                                {selectedReview?.status && <Badge text={reviewLabel(selectedReview.status)} tone={selectedReview.status === 'approved' ? 'success' : selectedReview.status === 'changes_requested' ? 'danger' : 'blue'} />}
                              </div>
                              <label className="field">
                                <span>Observações para o editor</span>
                                <textarea className="textarea" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Descreva ajustes de corte, legenda, cor, áudio ou aprovação." />
                              </label>
                              <div className="button-row compact no-margin">
                                <button className="secondary" onClick={() => saveVideoReview('commented')}><FileText size={14} /> Salvar observação</button>
                                <button className="secondary" onClick={() => saveVideoReview('changes_requested')}><RefreshCw size={14} /> Pedir ajustes</button>
                                <button className="primary" onClick={() => saveVideoReview('approved')}><Check size={14} /> Aprovar vídeo</button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="empty-box review-empty">
                        <span>Nenhum vídeo editado carregado. Coloque o arquivo na pasta Vídeo editado e clique em buscar vídeos.</span>
                      </div>
                    )}
                    {reviewFeedback && <p className="muted-note">{reviewFeedback}</p>}
                  </div>
                )}
              </>
            )}
            <label className="field span">
              <span>Observações internas</span>
              <textarea className="textarea" value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
          </div>
          <ActionList compact items={[
            ['Criado em', dateTime(form.createdAt)],
            ['Atualizado em', dateTime(form.updatedAt)],
            ['Origem', form.source || 'cronograma'],
          ]} />
          <div className="button-row">
            <button className="secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="primary" onClick={saveContent}><Check size={16} /> Salvar conteúdo</button>
          </div>
        </div>
      </Modal>
    </section>
  )
}

// ============================================================
// CALENDÁRIO — 3 modos: edição, capa, postagem
// ============================================================
function Calendario({ state }) {
  const [viewMode, setViewMode] = useState('postagem') // 'edicao' | 'capa' | 'postagem'
  const [calView, setCalView] = useState('week') // 'week' | 'month'
  const [weekOffset, setWeekOffset] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState({ member: '', client: '', format: '', status: '' })
  const [selectedDay, setSelectedDay] = useState(null) // dateStr — painel de eventos do dia
  const [selectedEvent, setSelectedEvent] = useState(null) // event object — modal de detalhes

  const { year, month } = currentMonth
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

  const prevMonth = () => setCurrentMonth(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 })
  const nextMonth = () => setCurrentMonth(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 })

  const allClients = [...new Set([...(state.clients || []).map(c => c.name), ...(state.leads || []).map(l => l.name)])]
  const allMembers = ['DBE', 'Thayane', 'Jonatas', 'Editor']
  const allFormats = ['Reels', 'Post estático', 'Carrossel', 'Stories', 'Legenda']
  const allStatuses = ['Ideia', 'A produzir', 'Em produção', 'Aprovado', 'Postado']

  const getEvents = () => {
    const events = []
    const scripts = state.scripts || []
    const posts = state.posts || []

    if (viewMode === 'edicao') {
      scripts.forEach((s) => {
        const d = s.edit_date || s.due_date || s.delivery_date
        if (d) events.push({ date: d.slice(0, 10), label: s.title || 'Roteiro', sub: s.editor || s.owner || 'DBE', type: 'edicao', status: s.status, client: s.client, format: s.format, member: s.editor || s.owner })
      })
      ;(state.cronograma || []).forEach((c) => {
        const d = c.edit_date || c.due
        if (d) events.push({ date: d.slice(0, 10), label: c.title || c.format || 'Conteúdo', sub: c.editor || c.owner || 'DBE', type: 'edicao', status: c.status, client: c.client, format: c.format, member: c.editor || c.owner })
      })
    } else if (viewMode === 'capa') {
      posts.forEach((p) => {
        const d = p.cover_date || p.date
        if (d) events.push({ date: d.slice(0, 10), label: p.caption ? p.caption.slice(0, 28) + '...' : 'Post', sub: p.client || p.network || '', type: 'capa', status: p.status, client: p.client, format: p.network })
      })
      ;(state.cronograma || []).forEach((c) => {
        const d = c.cover_date || c.date
        if (d) events.push({ date: d.slice(0, 10), label: c.title || c.format || 'Capa', sub: c.client || '', type: 'capa', status: c.status, client: c.client, format: c.format })
      })
    } else {
      posts.forEach((p) => {
        const d = p.date || p.scheduled_date
        if (d) events.push({ date: d.slice(0, 10), label: p.caption ? p.caption.slice(0, 28) + '...' : 'Post', sub: p.client || p.network || '', type: 'postagem', status: p.status, client: p.client, format: p.network })
      })
      ;(state.cronograma || []).forEach((c) => {
        const d = c.post_date || c.date
        if (d) events.push({ date: d.slice(0, 10), label: c.title || c.format || 'Conteúdo', sub: c.client || '', type: 'postagem', status: c.status, client: c.client, format: c.format })
      })
    }
    return events
  }

  const allEvents = useMemo(() => {
    let evs = getEvents()
    if (filters.client) evs = evs.filter(e => e.client === filters.client)
    if (filters.member) evs = evs.filter(e => (e.member || e.sub || '').includes(filters.member))
    if (filters.format) evs = evs.filter(e => (e.format || '').includes(filters.format))
    if (filters.status) evs = evs.filter(e => (e.status || '').includes(filters.status))
    return evs
  }, [state, viewMode, filters])

  const viewLabels = { edicao: 'Datas de Edição', capa: 'Datas de Capa', postagem: 'Datas de Postagem' }
  const hasFilters = Object.values(filters).some(Boolean)

  // === VISÃO SEMANAL ===
  const getWeekDays = () => {
    const base = new Date(today)
    base.setDate(today.getDate() - today.getDay() + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      const ds = d.toISOString().slice(0, 10)
      return { d, ds, evs: allEvents.filter(e => e.date === ds), isToday: ds === todayStr }
    })
  }
  const weekDays = getWeekDays()
  const weekLabel = (() => {
    const s = weekDays[0].d, e = weekDays[6].d
    if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} de ${monthNames[s.getMonth()]} ${s.getFullYear()}`
    return `${s.getDate()} ${monthNames[s.getMonth()].slice(0,3)} – ${e.getDate()} ${monthNames[e.getMonth()].slice(0,3)} ${e.getFullYear()}`
  })()

  // === VISÃO MENSAL ===
  const monthEvents = allEvents.filter(e => {
    const d = new Date(e.date + 'T12:00:00')
    return d.getFullYear() === year && d.getMonth() === month
  })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: daysInPrev - firstDay + 1 + i, otherMonth: true })
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, otherMonth: false, ds, events: monthEvents.filter(e => e.date === ds), isToday: ds === todayStr })
  }
  const rem = (7 - (cells.length % 7)) % 7
  for (let i = 1; i <= rem; i++) cells.push({ day: i, otherMonth: true })

  // Encontra o post/script original pelo evento para exibir detalhes
  const findSource = (ev) => {
    if (!ev) return null
    const posts = state.posts || []
    const scripts = state.scripts || []
    const cronograma = state.cronograma || []
    return posts.find(p => {
      const d = p.date || p.cover_date || p.scheduled_date
      return d && d.slice(0,10) === ev.date && (p.caption?.includes(ev.label.slice(0,20)) || p.client === ev.client)
    }) || scripts.find(s => s.title === ev.label || s.client === ev.client) || cronograma.find(c => (c.title || c.format) === ev.label) || ev
  }

  const dayEventsForPanel = selectedDay ? allEvents.filter(e => e.date === selectedDay) : []

  return (
    <section className="cal-shell page-grid">
      {/* Controles de tipo de data */}
      <div className="cal-view-bar">
        <button className={`cal-view-btn${viewMode === 'edicao' ? ' active' : ''}`} onClick={() => setViewMode('edicao')}>
          <Pencil size={13} />Edição
        </button>
        <button className={`cal-view-btn${viewMode === 'capa' ? ' active' : ''}`} onClick={() => setViewMode('capa')}>
          <Camera size={13} />Capa
        </button>
        <button className={`cal-view-btn${viewMode === 'postagem' ? ' active' : ''}`} onClick={() => setViewMode('postagem')}>
          <Send size={13} />Postagem
        </button>
        <div style={{marginLeft:'auto', display:'flex', gap:6, alignItems:'center'}}>
          <button className={`cal-view-btn${calView === 'week' ? ' active' : ''}`} onClick={() => setCalView('week')}>Semana</button>
          <button className={`cal-view-btn${calView === 'month' ? ' active' : ''}`} onClick={() => setCalView('month')}>Mês</button>
          <button className={`cal-view-btn${hasFilters ? ' active' : ''}`} onClick={() => setFilterOpen(true)} title="Filtros">
            <Filter size={13} />{hasFilters ? ' Filtros' : ' Filtrar'}
          </button>
        </div>
      </div>

      {/* Modal de filtros */}
      {filterOpen && (
        <div className="fin-modal-overlay" onClick={() => setFilterOpen(false)}>
          <div className="fin-modal" onClick={e => e.stopPropagation()} style={{maxWidth:380}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{margin:0,fontSize:16}}>Filtrar calendário</h3>
              <button className="icon-btn" onClick={() => setFilterOpen(false)}><X size={16} /></button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <label className="field"><span>Membro</span>
                <select value={filters.member} onChange={e => setFilters(f => ({...f, member: e.target.value}))}>
                  <option value="">Todos</option>{allMembers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="field"><span>Cliente</span>
                <select value={filters.client} onChange={e => setFilters(f => ({...f, client: e.target.value}))}>
                  <option value="">Todos</option>{allClients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="field"><span>Formato</span>
                <select value={filters.format} onChange={e => setFilters(f => ({...f, format: e.target.value}))}>
                  <option value="">Todos</option>{allFormats.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="field"><span>Status</span>
                <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))}>
                  <option value="">Todos</option>{allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="secondary" style={{flex:1}} onClick={() => setFilters({ member:'', client:'', format:'', status:'' })}>Limpar</button>
              <button className="primary" style={{flex:1}} onClick={() => setFilterOpen(false)}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Painel lateral: eventos do dia selecionado */}
      {selectedDay && (
        <div className="fin-modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="cal-day-panel" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <h3 style={{margin:0,fontSize:15}}>
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'})}
              </h3>
              <button className="icon-btn" onClick={() => setSelectedDay(null)}><X size={16} /></button>
            </div>
            {dayEventsForPanel.length === 0
              ? <p style={{color:'var(--muted)', fontSize:13}}>Nenhum conteúdo neste dia.</p>
              : dayEventsForPanel.map((ev, i) => (
                  <button
                    key={i}
                    className="cal-day-event-row"
                    onClick={() => { setSelectedEvent(ev); setSelectedDay(null) }}
                  >
                    <div className={`cal-dot ${ev.type}`} />
                    <div style={{flex:1, textAlign:'left'}}>
                      <strong style={{display:'block', fontSize:13}}>{ev.label}</strong>
                      <span style={{fontSize:11, color:'var(--muted)'}}>{ev.sub} {ev.status ? `· ${ev.status}` : ''}</span>
                    </div>
                    <ChevronRight size={14} style={{color:'var(--muted)', flexShrink:0}} />
                  </button>
                ))
            }
          </div>
        </div>
      )}

      {/* Modal de detalhes do post/evento */}
      {selectedEvent && (
        <div className="fin-modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="fin-modal" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{margin:0,fontSize:16}}>{selectedEvent.label}</h3>
              <button className="icon-btn" onClick={() => setSelectedEvent(null)}><X size={16} /></button>
            </div>
            {(() => {
              const src = findSource(selectedEvent)
              const rows = [
                ['Data', selectedEvent.date ? new Date(selectedEvent.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'],
                ['Cliente', src?.client || selectedEvent.client || '—'],
                ['Status', src?.status || selectedEvent.status || '—'],
                ['Formato / Rede', src?.network || src?.format || selectedEvent.format || '—'],
                ['Responsável', src?.owner || src?.editor || selectedEvent.member || selectedEvent.sub || '—'],
              ]
              return (
                <>
                  <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
                    {rows.map(([label, value]) => value && value !== '—' ? (
                      <div key={label} className="profile-info-row" style={{padding:'6px 0'}}>
                        <span>{label}</span><strong style={{textAlign:'right'}}>{value}</strong>
                      </div>
                    ) : null)}
                  </div>
                  {(src?.caption || src?.hook || src?.body) && (
                    <div style={{background:'var(--surface-2)', borderRadius:8, padding:'12px 14px', marginBottom:12}}>
                      {src.hook && <p style={{margin:'0 0 8px', fontSize:13, fontStyle:'italic', color:'var(--blue)'}}>"{src.hook}"</p>}
                      {src.caption && <p style={{margin:'0 0 8px', fontSize:13, whiteSpace:'pre-wrap'}}>{src.caption}</p>}
                      {src.body && <p style={{margin:0, fontSize:12, color:'var(--muted)', whiteSpace:'pre-wrap'}}>{src.body}</p>}
                    </div>
                  )}
                  {src?.cta && <p style={{fontSize:12, color:'var(--green)', margin:0}}><strong>CTA:</strong> {src.cta}</p>}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {calView === 'week' ? (
        <>
          <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
            <button className="secondary" style={{minHeight:34, padding:'0 12px'}} onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft size={16} /></button>
            <strong style={{fontSize:15, minWidth:180, textAlign:'center'}}>{weekLabel}</strong>
            <button className="secondary" style={{minHeight:34, padding:'0 12px'}} onClick={() => setWeekOffset(w => w + 1)}><ChevronRight size={16} /></button>
            {weekOffset !== 0 && <button className="ghost" style={{fontSize:12}} onClick={() => setWeekOffset(0)}>Hoje</button>}
            <span style={{color:'var(--muted)', fontSize:12}}>
              {weekDays.reduce((s, d) => s + d.evs.length, 0)} evento(s)
            </span>
          </div>
          <div className="cal-week-grid">
            {weekDays.map(({ d, ds, evs, isToday }) => (
              <div key={ds} className={`cal-week-day${isToday ? ' today' : ''}${evs.length > 0 ? ' has-events' : ''}`}>
                <div className="cal-week-header" onClick={() => evs.length > 0 && setSelectedDay(ds)} style={{cursor: evs.length > 0 ? 'pointer' : 'default'}}>
                  <span className="cal-week-dayname">{dayNames[d.getDay()]}</span>
                  <span className={`cal-week-daynum${isToday ? ' today' : ''}`}>{d.getDate()}</span>
                  {evs.length > 0 && <span className="cal-week-count">{evs.length}</span>}
                </div>
                <div className="cal-week-events">
                  {evs.length === 0 && <div style={{height:8}} />}
                  {evs.map((ev, i) => (
                    <div
                      key={i}
                      className={`cal-event ${ev.type}${ev.status?.toLowerCase().includes('aprovado') || ev.status?.toLowerCase().includes('postado') ? '' : ' pendente'}`}
                      title={`${ev.label} — ${ev.sub}`}
                      onClick={() => setSelectedEvent(ev)}
                      style={{cursor:'pointer'}}
                    >
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>{ev.label}</span>
                      {ev.sub && <span style={{opacity:.7,fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>{ev.sub}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <button className="secondary" style={{minHeight:34, padding:'0 12px'}} onClick={prevMonth}><ChevronLeft size={16} /></button>
            <strong style={{fontSize:16, minWidth:160, textAlign:'center'}}>{monthNames[month]} {year}</strong>
            <button className="secondary" style={{minHeight:34, padding:'0 12px'}} onClick={nextMonth}><ChevronRight size={16} /></button>
            <span style={{color:'var(--muted)', fontSize:12, marginLeft:8}}>{monthEvents.length} evento(s)</span>
          </div>
          <div className="cal-grid">
            {dayNames.map((d) => <div key={d} className="cal-day-header">{d}</div>)}
            {cells.map((cell, i) => (
              <div
                key={i}
                className={`cal-day${cell.otherMonth ? ' other-month' : ''}${cell.isToday ? ' today' : ''}${(cell.events || []).length > 0 ? ' has-events' : ''}`}
                onClick={() => !cell.otherMonth && cell.ds && setSelectedDay(cell.ds)}
                style={{cursor: (!cell.otherMonth && (cell.events || []).length > 0) ? 'pointer' : 'default'}}
              >
                <div className="cal-day-num">{cell.day}</div>
                {(cell.events || []).length > 0 && (
                  <div className="cal-day-dots">
                    {(cell.events || []).slice(0, 4).map((ev, ei) => (
                      <span key={ei} className={`cal-dot ${ev.type}`} title={ev.label} />
                    ))}
                    {(cell.events || []).length > 4 && <span style={{fontSize:9, color:'var(--muted)'}}>+{cell.events.length - 4}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function Teleprompter({ state }) {
  const scripts = state.scripts || []
  const clients = state.clients || []

  // 1. Selecionar cliente primeiro
  const [selectedClient, setSelectedClient] = useState(clients[0]?.name || '')
  // 2. Depois filtrar roteiros desse cliente
  const clientScripts = selectedClient
    ? scripts.filter((s) => s.client === selectedClient || s.client_name === selectedClient)
    : scripts
  const [selected, setSelected] = useState('')
  const [font, setFont] = useState(42)
  const [speed, setSpeed] = useState(1)
  const [running, setRunning] = useState(false)
  const [mirror, setMirror] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const readerRef = useRef(null)

  // Quando cliente muda, reseta o roteiro para o primeiro do cliente
  useEffect(() => {
    setSelected(clientScripts[0]?.id || '')
    setRunning(false)
    if (readerRef.current) readerRef.current.scrollTop = 0
  }, [selectedClient])

  const script = clientScripts.find((item) => item.id === selected) || clientScripts[0]
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
          {/* Passo 1: Cliente */}
          <Select
            label="1. Cliente"
            value={selectedClient}
            onChange={(v) => setSelectedClient(v)}
            options={['', ...clients.map((c) => c.name)].map((n) => ({ label: n || 'Todos', value: n }))}
          />
          {/* Passo 2: Roteiro do cliente */}
          <Select
            label="2. Roteiro"
            value={selected}
            onChange={setSelected}
            options={clientScripts.length
              ? clientScripts.map((s) => ({ label: s.title, value: s.id }))
              : [{ label: 'Nenhum roteiro encontrado', value: '' }]
            }
          />
          <Input label="Tamanho da fonte" type="number" value={font} onChange={setFont} />
          <Input label="Velocidade" type="number" value={speed} onChange={setSpeed} />
          <div className="button-row no-margin span">
            <button className="primary" onClick={() => setRunning(!running)}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'Pausar' : 'Iniciar'}</button>
            <button className="secondary" onClick={() => { if (readerRef.current) readerRef.current.scrollTop = 0; setRunning(false) }}><RefreshCw size={16} /> Reiniciar</button>
            <button className="secondary" onClick={() => setMirror(!mirror)}>Espelhar</button>
            <button className="secondary" onClick={() => setFocusMode(!focusMode)}>{focusMode ? 'Sair do foco' : 'Modo foco'}</button>
          </div>
        </div>
      </Panel>
      {script ? (
        <div className="teleprompter-stage">
          <div className="read-line" />
          <div ref={readerRef} className={mirror ? 'reader mirror' : 'reader'} style={{ fontSize: `${font}px` }}>
            {text.split('\n').map((line, index) => <p key={index}>{line || ' '}</p>)}
          </div>
          <div className="teleprompter-footer">
            <span>{script?.title}</span>
            <strong>{running ? 'Lendo...' : 'Pausado'}</strong>
            <span>{Math.ceil(text.length / 850)} min estimado</span>
          </div>
        </div>
      ) : (
        <div className="empty-box" style={{textAlign:'center', padding:40}}>
          <MonitorPlay size={32} style={{margin:'0 auto 12px', color:'var(--muted)', display:'block'}} />
          Selecione um cliente com roteiros cadastrados para usar o teleprompter.
        </div>
      )}
    </section>
  )
}

function DebyAI({ state, addItem, updateItem }) {
  const [input, setInput] = useState('Gerar roteiro para um médico que trava na câmera e precisa atrair paciente particular.')
  const [feature, setFeature] = useState('roteiro')
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [saveForm, setSaveForm] = useState({
    client_id: state.clients[0]?.id || '',
    format: 'Roteiro de Reels',
    title: '',
    priority: 'Média',
  })
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

  const saveAsContent = async () => {
    const client = state.clients.find((item) => item.id === saveForm.client_id) || state.clients[0]
    if (!client || !saveForm.title) return
    const now = new Date().toISOString()
    const record = await addItem('scripts', {
      client_id: client.id,
      client: client.name,
      title: saveForm.title,
      format: saveForm.format,
      status: saveForm.format === 'Roteiro de Reels' ? 'Roteiro pronto' : 'Ideia',
      responsible: 'DBE',
      priority: saveForm.priority,
      body: shown,
      caption: feature === 'legenda' ? shown : '',
      source: 'deby',
      createdAt: now,
      updatedAt: now,
    })
    if (saveForm.format === 'Roteiro de Reels') {
      const folderRes = await drive.createContentFolder(record.id, client.id, client.name, saveForm.title)
      if (folderRes.ok) {
        updateItem('scripts', record.id, {
          ...record,
          drive_folder_id: folderRes.folderId,
          drive_folder_url: folderRes.folderUrl,
          edited_folder_id: folderRes.editedFolderId,
          edited_folder_url: folderRes.editedFolderUrl,
          updatedAt: new Date().toISOString(),
        })
      }
    }
    setSaveForm({ ...saveForm, title: '' })
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
        <div className="quick-create">
          <h3>Criar conteúdo</h3>
          <div className="form-grid">
            <Select label="Cliente" value={saveForm.client_id} onChange={(client_id) => setSaveForm({ ...saveForm, client_id })} options={state.clients.map((client) => ({ label: client.name, value: client.id }))} />
            <Select label="Tipo" value={saveForm.format} onChange={(format) => setSaveForm({ ...saveForm, format })} options={['Roteiro de Reels', 'Carrossel', 'Post estático']} />
            <Input label="Título" value={saveForm.title} onChange={(title) => setSaveForm({ ...saveForm, title })} />
            <Select label="Prioridade" value={saveForm.priority} onChange={(priority) => setSaveForm({ ...saveForm, priority })} options={CONTENT_PRIORITIES} />
            <button className="primary span" onClick={saveAsContent}><Plus size={16} /> Salvar no cronograma</button>
          </div>
        </div>
      </Panel>
      <Panel title="Resposta da Deby">
        <pre className="ai-output">{busy ? 'A Deby está pensando...' : shown}</pre>
      </Panel>
    </section>
  )
}

function InstagramStudio({ state, addItem, updateItem }) {
  const [form, setForm] = useState({ client: state.clients[0]?.name || '', network: 'Instagram', date: '2026-05-27T10:00', status: 'Faltam fazer', caption: '' })
  const postStatuses = ['Ideia aprovada', 'Faltam fazer', 'Feita', 'Aprovada', 'Falta agendamento', 'Agendado', 'Reprovada', 'Publicado']
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

function InstagramAnalytics({ state, currentUser }) {
  const params = new URLSearchParams(window.location.search)
  const initialClientId = params.get('instagram_client_id') || state.clients[0]?.id || ''
  const [clientId, setClientId] = useState(initialClientId)
  const [data, setData] = useState({ integration: null, accountMetrics: [], mediaMetrics: [], totals: {} })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [aiText, setAiText] = useState('')
  const selected = state.clients.find((client) => client.id === clientId) || state.clients[0]
  const integration = data.integration
  const accountMetrics = data.accountMetrics || []
  const mediaMetrics = data.mediaMetrics || []
  const totals = data.totals || {}
  const topMedia = [...mediaMetrics].sort((a, b) => instagramPostScore(b) - instagramPostScore(a)).slice(0, 8)
  const chartRows = accountMetrics.slice(-14)
  const maxChart = Math.max(1, ...chartRows.map((row) => Math.max(Number(row.reach || 0), Number(row.views || 0))))

  const loadStatus = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    const res = await meta.instagramStatus(clientId, currentUser)
    setLoading(false)
    if (res.ok) setData(res)
    else notify(res.error || 'Nao foi possivel carregar o Instagram.', 'danger')
  }, [clientId, currentUser])

  useEffect(() => {
    if (!clientId && state.clients[0]?.id) setClientId(state.clients[0].id)
  }, [clientId, state.clients])

  useEffect(() => { loadStatus() }, [loadStatus])

  useEffect(() => {
    const connected = params.get('instagram_connected')
    const error = params.get('instagram_error')
    if (connected) notify('Instagram conectado com sucesso.', 'success')
    if (error) notify(decodeURIComponent(error), 'danger')
  }, [])

  const connectInstagram = async () => {
    if (!selected?.id) return
    setBusy('connect')
    const res = await meta.instagramAuthUrl(selected.id, currentUser)
    setBusy('')
    if (res.ok && res.url) window.location.href = res.url
    else notify(res.error || 'Falha ao iniciar OAuth da Meta.', 'danger')
  }

  const syncNow = async () => {
    if (!selected?.id || !integration) return
    setBusy('sync')
    const account = await meta.syncInstagramAccount(selected.id, currentUser)
    if (!account.ok) {
      setBusy('')
      notify(account.error || 'Falha ao sincronizar conta.', 'danger')
      return
    }
    const media = await meta.syncInstagramMedia(selected.id, currentUser)
    setBusy('')
    if (media.ok) {
      setData(media)
      notify('Metricas do Instagram sincronizadas.', 'success')
    } else {
      setData(account)
      notify(media.error || 'Conta sincronizada, mas posts nao foram atualizados.', 'warning')
    }
  }

  const disconnect = async () => {
    if (!selected?.id || !integration) return
    setBusy('disconnect')
    const res = await meta.disconnectInstagram(selected.id, currentUser)
    setBusy('')
    if (res.ok) {
      setData(res)
      notify('Instagram desconectado deste cliente.', 'success')
    } else {
      notify(res.error || 'Falha ao desconectar Instagram.', 'danger')
    }
  }

  const generateInsights = async () => {
    if (!integration) return
    setBusy('ai')
    const res = await ai.ask(
      'analise',
      'Analise as metricas de Instagram deste cliente e gere insights praticos para a DBE priorizar conteudo, formatos e proximas acoes.',
      buildInstagramInsightContext(selected, data),
    )
    setBusy('')
    if (res.ok) setAiText(res.text)
    else notify(res.error || 'Falha ao gerar insights.', 'danger')
  }

  return (
    <section className="page-grid">
      <Panel title="Instagram Analytics">
        <div className="instagram-analytics-head">
          <Select
            label="Cliente"
            value={selected?.id || ''}
            onChange={(value) => setClientId(value)}
            options={state.clients.map((client) => ({ label: client.name, value: client.id }))}
          />
          <div className="instagram-status-card">
            <span>Status da conexao</span>
            <strong>{integration ? `@${integration.instagram_username || integration.instagram_user_id}` : 'Nao conectado'}</strong>
            <Badge text={integration ? 'Conectado' : 'Pendente'} tone={integration ? 'success' : 'gold'} />
          </div>
          <div className="button-row no-margin">
            <button className="primary" onClick={connectInstagram} disabled={busy === 'connect' || !selected}>
              <Camera size={16} /> {integration ? 'Trocar conta' : 'Conectar Instagram'}
            </button>
            <button className="secondary" onClick={syncNow} disabled={!integration || busy === 'sync'}>
              <RefreshCw size={16} /> {busy === 'sync' ? 'Sincronizando...' : 'Sincronizar agora'}
            </button>
            <button className="ghost" onClick={disconnect} disabled={!integration || busy === 'disconnect'}>
              <X size={16} /> Desconectar
            </button>
          </div>
        </div>
        <p className="muted-note">
          A tela usa dados salvos no Supabase. A Meta so e chamada quando voce conecta a conta ou clica em sincronizar.
          {integration?.last_sync_at ? ` Ultima sincronizacao: ${dateTime(integration.last_sync_at)}.` : ''}
        </p>
        {loading && <div className="inline-notice">Carregando metricas salvas...</div>}
      </Panel>

      <div className="grid-4">
        <MiniStat label="Alcance" value={compactNumber(totals.reach)} tone="blue" />
        <MiniStat label="Views" value={compactNumber(totals.views)} tone="success" />
        <MiniStat label="Seguidores" value={compactNumber(totals.followers)} tone="gold" />
        <MiniStat label="Interacoes" value={compactNumber(Number(totals.likes || 0) + Number(totals.comments || 0) + Number(totals.shares || 0) + Number(totals.saves || 0))} tone="danger" />
      </div>

      {!integration ? (
        <Panel title="Conectar conta profissional">
          <div className="empty-box">
            Selecione o cliente e conecte uma conta profissional do Instagram vinculada a uma Pagina do Facebook.
            O historico antigo sera mantido quando a conta for trocada.
          </div>
        </Panel>
      ) : (
        <div className="grid-2 align-start">
          <Panel title="Alcance e views por periodo">
            {chartRows.length ? (
              <div className="ig-chart">
                {chartRows.map((row) => (
                  <div className="ig-chart-row" key={row.metric_date}>
                    <span>{date(row.metric_date)}</span>
                    <div>
                      <i className="reach" style={{ width: `${Math.max(4, (Number(row.reach || 0) / maxChart) * 100)}%` }} />
                      <i className="views" style={{ width: `${Math.max(4, (Number(row.views || 0) / maxChart) * 100)}%` }} />
                    </div>
                    <strong>{compactNumber(row.reach)} / {compactNumber(row.views)}</strong>
                  </div>
                ))}
              </div>
            ) : <div className="empty-box">Sincronize para montar o grafico.</div>}
          </Panel>

          <Panel title="Resumo da conta">
            <div className="grid-2">
              <MiniStat label="Visitas ao perfil" value={compactNumber(totals.profileViews)} tone="blue" />
              <MiniStat label="Cliques no site" value={compactNumber(totals.websiteClicks)} tone="success" />
              <MiniStat label="Salvamentos" value={compactNumber(totals.saves)} tone="gold" />
              <MiniStat label="Compartilhamentos" value={compactNumber(totals.shares)} tone="danger" />
            </div>
          </Panel>
        </div>
      )}

      <Panel title="Ranking de melhores posts e reels">
        {topMedia.length ? (
          <div className="ig-ranking">
            {topMedia.map((post, index) => (
              <article className="ig-post-row" key={post.id}>
                <strong>{index + 1}</strong>
                <div>
                  <h3>{post.caption || post.media_type || 'Publicacao sem legenda'}</h3>
                  <span>{post.media_type || 'MIDIA'} - {post.timestamp ? dateTime(post.timestamp) : '-'}</span>
                </div>
                <MiniStat label="Score" value={compactNumber(instagramPostScore(post))} tone="blue" />
                <MiniStat label="Alcance" value={compactNumber(post.reach)} tone="success" />
                <MiniStat label="Views" value={compactNumber(post.views)} tone="gold" />
                {post.permalink && <button className="ghost" onClick={() => window.open(post.permalink, '_blank')}><ExternalLink size={14} /></button>}
              </article>
            ))}
          </div>
        ) : <div className="empty-box">Nenhuma midia sincronizada ainda.</div>}
      </Panel>

      <Panel title="Insights com IA">
        <div className="button-row no-margin">
          <button className="secondary" onClick={generateInsights} disabled={!integration || busy === 'ai'}>
            <Sparkles size={16} /> {busy === 'ai' ? 'Analisando...' : 'Gerar insights'}
          </button>
          <button className="ghost" onClick={() => copyText(aiText)} disabled={!aiText}><Copy size={16} /> Copiar</button>
        </div>
        <pre className="ai-output compact-ai">{aiText || 'Sincronize as metricas e gere uma leitura estrategica para proximos conteudos.'}</pre>
      </Panel>
    </section>
  )
}

function instagramPostScore(post) {
  return Number(post.reach || 0) + Number(post.views || 0) + (Number(post.likes || 0) * 2) + (Number(post.comments || 0) * 5) + (Number(post.shares || 0) * 6) + (Number(post.saves || 0) * 6)
}

function compactNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
}

function buildInstagramInsightContext(client, payload) {
  const totals = payload.totals || {}
  const posts = (payload.mediaMetrics || []).slice(0, 10).map((post) => ({
    tipo: post.media_type,
    legenda: String(post.caption || '').slice(0, 180),
    alcance: post.reach,
    views: post.views,
    curtidas: post.likes,
    comentarios: post.comments,
    compartilhamentos: post.shares,
    salvamentos: post.saves,
  }))
  return JSON.stringify({
    cliente: client?.name,
    segmento: client?.segment,
    instagram: payload.integration?.instagram_username,
    totais: totals,
    melhores_publicacoes: posts,
  }, null, 2)
}

function Conversas({ state, addItem }) {
  const [waConversations, setWaConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [contactQuery, setContactQuery] = useState('')
  const [contactId, setContactId] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [activeTemplate, setActiveTemplate] = useState('')
  const [mobileConvView, setMobileConvView] = useState('list') // 'list' | 'chat'
  const [profileOpen, setProfileOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [contactNotes, setContactNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dbe-contact-notes') || '{}') } catch { return {} }
  })
  const [contactTags, setContactTags] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dbe-contact-tags') || '{}') } catch { return {} }
  })

  const CONTACT_TAG_LIST = ['Cliente', 'Lead novo', 'Marcou reunião', 'Não compareceu', 'Fechou contrato', 'Não fechou', 'Reativação', 'Quente', 'Morno', 'Frio']

  const getContactKey = (c) => c?.phone || c?.id || ''

  const saveNote = (contactKey, text) => {
    const updated = { ...contactNotes, [contactKey]: text }
    setContactNotes(updated)
    localStorage.setItem('dbe-contact-notes', JSON.stringify(updated))
  }

  const toggleTag = (contactKey, tag) => {
    const current = contactTags[contactKey] || []
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
    const updated = { ...contactTags, [contactKey]: next }
    setContactTags(updated)
    localStorage.setItem('dbe-contact-tags', JSON.stringify(updated))
  }
  const bodyRef = useRef(null)
  const fileInputRef = useRef(null)
  const recorderRef = useRef(null)
  const recTimerRef = useRef(null)

  const crmContacts = [
    ...state.leads.map((lead) => ({ ...lead, type: 'Lead', subtitle: `${lead.status} · ${lead.temp}`, last: lead.next || lead.notes })),
    ...state.clients.map((client) => ({ ...client, type: 'Cliente', subtitle: `${client.status} · ${client.plan}`, last: client.next || client.segment })),
  ]
  const realPhones = new Set(waConversations.map((item) => String(item.remote_jid || '').split('@')[0]))
  const contacts = [
    ...waConversations.map((item) => ({
      id: `wa:${item.remote_jid}`,
      remote_jid: item.remote_jid,
      phone: String(item.remote_jid || '').split('@')[0],
      name: item.name || String(item.remote_jid || '').split('@')[0],
      profile_pic: item.profile_pic,
      type: 'WhatsApp',
      subtitle: `WhatsApp · ${item.last_at ? dateTime(item.last_at) : ''}`,
      last: item.last_message || '',
      unread: item.unread || 0,
    })),
    ...crmContacts.filter((item) => !realPhones.has(String(item.phone || '').replace(/\D/g, ''))),
  ].filter((item) => !contactQuery || JSON.stringify(item).toLowerCase().includes(contactQuery.toLowerCase()))

  const selected = contacts.find((item) => item.id === contactId) || contacts[0]

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages])

  const refreshConversations = async () => {
    if (!isSupabaseConfigured) return
    const rows = await loadConversations()
    setWaConversations(rows)
  }

  const syncContacts = async () => {
    setFeedback('Sincronizando...')
    const res = await whatsapp.syncContacts?.()
    if (res?.ok) { setFeedback(`${res.imported || 0} sincronizados.`); refreshConversations() }
    else setFeedback(res?.error || 'Erro ao sincronizar')
    setTimeout(() => setFeedback(''), 3000)
  }

  useEffect(() => { refreshConversations() }, [])

  useEffect(() => {
    if (!contactId && contacts[0]?.id) setContactId(contacts[0].id)
  }, [contacts[0]?.id])

  useEffect(() => {
    if (!selected?.remote_jid || !isSupabaseConfigured) { setMessages([]); return }
    let alive = true
    loadMessages(selected.remote_jid).then((rows) => { if (alive) setMessages(rows) })
    return () => { alive = false }
  }, [selected?.remote_jid])

  // Fecha o perfil ao trocar de contato
  useEffect(() => { setProfileOpen(false) }, [contactId])

  const applyTemplate = (type) => {
    setActiveTemplate(type === activeTemplate ? '' : type)
    setDraft(conversationTemplate(type, selected))
  }

  const applyQuickTrigger = (type) => {
    const name = selected?.name || 'cliente'
    const phone = selected?.phone
    if (type === 'cobranca') {
      setDraft(`Olá, ${name}! 😊 Passando para lembrar que a mensalidade da DBE vence em breve. Para facilitar, segue a chave PIX: pagamentos@dbe.com.br\n\nQualquer dúvida é só chamar!`)
    } else if (type === 'aprovacao') {
      setDraft(`Oi, ${name}! Temos novos materiais prontos para a sua aprovação. Confere o link e nos dá o feedback: [insira o link aqui] 🙏`)
    }
    setProfileOpen(false)
  }

  const sendMessage = async () => {
    const text = draft.trim()
    if (!text || !selected?.phone) return
    setSending(true)
    const res = await whatsapp.send(selected.phone, text)
    setSending(false)
    if (res.ok) {
      const newMsg = { id: res.id || crypto.randomUUID(), from_me: true, content: text, message_type: 'text', ts: new Date().toISOString() }
      setMessages((prev) => [...prev, newMsg])
      setDraft('')
      setActiveTemplate('')
      refreshConversations()
    } else {
      setFeedback(`Falha: ${res.error}`)
      setTimeout(() => setFeedback(''), 4000)
      openWhatsApp(selected.phone, text)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // Gravação de áudio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec
      const chunks = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const dur = recSeconds
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), from_me: true, content: '', message_type: 'audio',
          media_url: url, media_mime: 'audio/webm', duration: dur, ts: new Date().toISOString(),
        }])
        setRecSeconds(0)
      }
      rec.start()
      setRecording(true)
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch { setFeedback('Microfone não disponível'); setTimeout(() => setFeedback(''), 3000) }
  }

  const stopRecording = () => {
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
    clearInterval(recTimerRef.current)
    setRecording(false)
  }

  const fmtDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // Anexar arquivo
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const mime = file.type
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(), from_me: true, content: file.name, message_type: mime.startsWith('image/') ? 'image' : 'file',
      media_url: url, media_mime: mime, ts: new Date().toISOString(),
    }])
    e.target.value = ''
  }

  // Renderiza mídia na bolha
  const renderMedia = (msg) => {
    if (msg.message_type === 'audio' && msg.media_url) {
      return (
        <div className="msg-audio-wrap">
          <ContactAvatar contact={msg.from_me ? { name: 'DBE' } : selected} size={28} />
          <div className="msg-audio-player">
            <audio controls src={msg.media_url} style={{height:32, minWidth:160, maxWidth:220}} />
            <span className="msg-audio-dur">{fmtDur(msg.duration || 0)}</span>
          </div>
        </div>
      )
    }
    if (!msg.media_url) return null
    const mime = msg.media_mime || ''
    if (mime.startsWith('image/')) return <div className="msg-media"><img src={msg.media_url} alt="foto" style={{maxWidth:220, borderRadius:8}} /></div>
    if (mime.startsWith('video/')) return <div className="msg-media"><video src={msg.media_url} controls style={{maxWidth:220}} /></div>
    return <a className="msg-media-link" href={msg.media_url} target="_blank" rel="noreferrer"><Paperclip size={14} /> {msg.content || 'Abrir arquivo'}</a>
  }

  // Agrupa mensagens por dia
  const groupedMessages = useMemo(() => {
    const groups = []
    let lastDay = ''
    messages.forEach((msg) => {
      const d = msg.ts ? new Date(msg.ts).toLocaleDateString('pt-BR') : ''
      if (d !== lastDay) { groups.push({ type: 'divider', label: d }); lastDay = d }
      groups.push({ type: 'msg', msg })
    })
    return groups
  }, [messages])

  const templates = ['Diagnóstico', 'Aprovação', 'Cobrança', 'Reativação']

  // Dados do contato no CRM (para o perfil)
  const crmInfo = selected
    ? (state.clients.find(c => c.name === selected.name || c.phone === selected.phone) ||
       state.leads.find(l => l.name === selected.name || l.phone === selected.phone))
    : null

  return (
    <section className="conversation-shell">
      {/* Lista de contatos */}
      <aside className={`conversation-list${mobileConvView === 'chat' ? ' mobile-hidden' : ''}`}>
        <div className="conversation-sidebar-head">
          <div>
            <p className="eyebrow" style={{margin:0, fontSize:11}}>Conversas</p>
            <h2 style={{margin:0, fontSize:16}}>Caixa DBE</h2>
          </div>
          <button className="icon-btn" title="Sincronizar" onClick={syncContacts}><RefreshCw size={15} /></button>
        </div>
        <div className="conversation-search">
          <label className="search">
            <Search size={15} />
            <input value={contactQuery} onChange={(e) => setContactQuery(e.target.value)} placeholder="Buscar contato..." />
          </label>
        </div>
        <div className="chat-list">
          {contacts.length === 0 && <div style={{padding:16, color:'var(--muted)', fontSize:13}}>Nenhum contato encontrado.</div>}
          {contacts.map((contact) => (
            <button
              key={contact.id}
              className={selected?.id === contact.id ? 'active' : ''}
              onClick={() => { setContactId(contact.id); setDraft(''); setActiveTemplate(''); setMobileConvView('chat') }}
            >
              <ContactAvatar contact={contact} />
              <div className="chat-list-info">
                <strong>{contact.name}</strong>
                <small>{contact.last || contact.subtitle || ''}</small>
              </div>
              <div className="chat-list-meta">
                {contact.unread > 0 && <span className="chat-unread">{contact.unread}</span>}
                <span style={{fontSize:10, color:'var(--soft)'}}>{contact.type}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Área principal do chat */}
      <div className={`conversation-main${mobileConvView === 'list' ? ' mobile-hidden' : ''}`}>
        {/* Header do chat */}
        <header className="chat-head">
          {/* Botão voltar (só mobile) */}
          <button
            className="chat-back-btn"
            onClick={() => setMobileConvView('list')}
            title="Voltar para conversas"
            style={{background:'transparent',border:0,padding:'0 4px 0 0',cursor:'pointer',flexShrink:0,display:'none'}}
            aria-label="Voltar"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            className="chat-avatar-btn"
            onClick={() => setProfileOpen(true)}
            title="Ver perfil do contato"
            style={{background:'transparent',border:0,padding:0,cursor:'pointer',flexShrink:0}}
          >
            <ContactAvatar contact={selected || { name: 'DBE' }} />
          </button>
          <div className="chat-head-info" style={{cursor:'pointer'}} onClick={() => setProfileOpen(true)}>
            <h2>{selected?.name || 'Selecione um contato'}</h2>
            <p>
              {selected?.phone ? `+${selected.phone}` : 'sem telefone'}
              {selected?.remote_jid ? ' · WhatsApp ativo' : ' · CRM'}
            </p>
          </div>
          <div className="chat-head-actions">
            {feedback && <span style={{fontSize:12, color:'var(--green)', padding:'0 8px'}}>{feedback}</span>}
            <button className="icon-btn" title="Copiar último" onClick={() => copyText(draft || messages.at(-1)?.content || '')}><Copy size={16} /></button>
            <button className="icon-btn" title="Abrir no WhatsApp Web" onClick={() => selected && openWhatsApp(selected.phone, draft)}><MessageCircle size={16} /></button>
          </div>
        </header>

        {/* Mensagens */}
        <div className="chat-body" ref={bodyRef}>
          {groupedMessages.length === 0 && (
            <div style={{textAlign:'center', padding:'40px 20px', color:'var(--muted)'}}>
              <MessageCircle size={32} style={{marginBottom:12, opacity:0.4}} />
              <div style={{fontSize:13}}>
                {selected?.remote_jid ? 'Carregando mensagens...' : 'Contato do CRM — use um template para iniciar a conversa.'}
              </div>
            </div>
          )}
          {groupedMessages.map((item, i) => {
            if (item.type === 'divider') {
              return <div key={i} className="msg-day-divider"><span>{item.label}</span></div>
            }
            const msg = item.msg
            if (msg.message_type === 'audio') {
              return (
                <div key={msg.id || `${msg.ts}-${i}`} className={`message-bubble ${msg.from_me ? 'outbound' : 'inbound'} audio-bubble`}>
                  {renderMedia(msg)}
                  <div className="msg-meta">
                    <span className="msg-time">{msg.ts ? new Date(msg.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    {msg.from_me && <span className="msg-status">✓✓</span>}
                  </div>
                </div>
              )
            }
            return (
              <div
                key={msg.id || msg.wa_message_id || `${msg.ts}-${i}`}
                className={`message-bubble ${msg.from_me ? 'outbound' : 'inbound'}`}
              >
                {msg.content && <span className="msg-content">{msg.content}</span>}
                {renderMedia(msg)}
                <div className="msg-meta">
                  <span className="msg-time">{msg.ts ? new Date(msg.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  {msg.from_me && <span className="msg-status">✓✓</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Templates rápidos */}
        <div className="chat-template-bar">
          {templates.map((t) => (
            <button key={t} className={`chat-template-btn${activeTemplate === t ? ' active' : ''}`} onClick={() => applyTemplate(t)}>
              {t}
            </button>
          ))}
        </div>

        {/* Compose */}
        <div className="chat-compose">
          <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={handleFileChange} />
          <button className="chat-compose-btn attach" title="Anexar arquivo" onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={18} />
          </button>
          {recording ? (
            <div className="chat-recording-bar">
              <span className="rec-dot" />
              <span style={{fontSize:13, color:'var(--red)', fontWeight:600}}>{fmtDur(recSeconds)}</span>
              <span style={{fontSize:12, color:'var(--muted)', marginLeft:6}}>Gravando...</span>
            </div>
          ) : (
            <textarea
              className="chat-compose-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem... (Enter para enviar)"
              rows={1}
            />
          )}
          {!draft.trim() && !recording ? (
            <button
              className={`chat-compose-btn mic${recording ? ' recording' : ''}`}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              title="Segurar para gravar áudio"
            >
              <Mic size={18} />
            </button>
          ) : recording ? (
            <button className="chat-compose-btn mic recording" onClick={stopRecording} title="Parar gravação">
              <MicOff size={18} />
            </button>
          ) : (
            <button
              className="chat-compose-btn send"
              onClick={sendMessage}
              disabled={sending}
              title="Enviar"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Painel de perfil do contato */}
      {profileOpen && selected && (
        <div className="contact-profile-panel">
          <div className="contact-profile-head">
            <h3>Perfil</h3>
            <button className="icon-btn" onClick={() => setProfileOpen(false)}><X size={16} /></button>
          </div>
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 16px 16px', gap:10}}>
            <ContactAvatar contact={selected} size={72} />
            <h2 style={{margin:0, fontSize:18, textAlign:'center'}}>{selected.name}</h2>
            {selected.phone && <p style={{margin:0, fontSize:13, color:'var(--muted)'}}>+{selected.phone}</p>}
            <span className="badge" style={{marginTop:4}}>{selected.type}</span>
          </div>
          {(() => {
            const cKey = getContactKey(selected)
            const tags = contactTags[cKey] || []
            const note = contactNotes[cKey] || ''
            return (
              <>
                {crmInfo && (
                  <div style={{padding:'0 16px', display:'flex', flexDirection:'column', gap:6}}>
                    {crmInfo.segment && <div className="profile-info-row"><span>Segmento</span><strong>{crmInfo.segment}</strong></div>}
                    {crmInfo.plan && <div className="profile-info-row"><span>Plano</span><strong>{crmInfo.plan}</strong></div>}
                    {crmInfo.status && <div className="profile-info-row"><span>Status</span><strong>{crmInfo.status}</strong></div>}
                    {crmInfo.monthly && <div className="profile-info-row"><span>Mensalidade</span><strong>{money(Number(crmInfo.monthly))}</strong></div>}
                    {crmInfo.next && <div className="profile-info-row"><span>Próxima ação</span><strong>{crmInfo.next}</strong></div>}
                  </div>
                )}

                {/* Tags */}
                <div style={{padding:'12px 16px'}}>
                  <p className="profile-section-title">Tags</p>
                  <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:8}}>
                    {CONTACT_TAG_LIST.map(tag => (
                      <button
                        key={tag}
                        className={`contact-tag-btn${tags.includes(tag) ? ' active' : ''}`}
                        onClick={() => toggleTag(cKey, tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Observações */}
                <div style={{padding:'0 16px 12px'}}>
                  <p className="profile-section-title">Observações</p>
                  <textarea
                    className="profile-notes-textarea"
                    value={note}
                    onChange={e => saveNote(cKey, e.target.value)}
                    placeholder="Anotações sobre este contato..."
                    rows={4}
                  />
                </div>

                {/* Gatilhos rápidos */}
                <div style={{padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:8}}>
                  <p className="profile-section-title">Gatilhos rápidos</p>
                  <button className="secondary" style={{justifyContent:'flex-start', gap:8, fontSize:13}} onClick={() => applyQuickTrigger('cobranca')}>
                    💰 Cobrança / PIX
                  </button>
                  <button className="secondary" style={{justifyContent:'flex-start', gap:8, fontSize:13}} onClick={() => applyQuickTrigger('aprovacao')}>
                    ✅ Material para aprovação
                  </button>
                  <button className="secondary" style={{justifyContent:'flex-start', gap:8, fontSize:13}} onClick={() => { openWhatsApp(selected.phone, ''); setProfileOpen(false) }}>
                    <MessageCircle size={14} /> Abrir no WhatsApp
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      )}
    </section>
  )
}

// Avatar de contato no estilo WhatsApp
function ContactAvatar({ contact, size = 40 }) {
  if (contact?.profile_pic) {
    return <div className="chat-avatar" style={{width:size,height:size,minWidth:size}}><img src={contact.profile_pic} alt={contact.name} /></div>
  }
  const ini = (contact?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return <div className="chat-avatar" style={{width:size,height:size,minWidth:size,fontSize:Math.round(size * 0.35)}}>{ini}</div>
}
// ═══════════════════════════════════════════════════════════════════════════
// FINANCEIRO COMPLETO — porta fiel do app financeiro com 7 abas
// ═══════════════════════════════════════════════════════════════════════════
const FIN_API = 'https://script.google.com/macros/s/AKfycbwz_1t5DSowR5t3KAAIVwam4sKy2DSTgTsbv62uaYBGvkqDZfYxpjX6su89iSDR0HoV/exec'
const FIN_MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const FIN_REC_CATS = ['Receitas com Clientes Pacotes','Receitas com Serviços Avulsos']

function finFmt(v, dec = 2) {
  const n = Math.round(v * 100) / 100
  return (n < 0 ? '- ' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function finShort(v) {
  const a = Math.abs(v)
  if (a >= 1000) return (v < 0 ? '-' : '') + 'R$ ' + (a / 1000).toFixed(1) + 'k'
  return finFmt(v)
}
function finDate(d) {
  if (!d) return '—'
  try { return new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) } catch { return d }
}
function finGrp(c) {
  if (FIN_REC_CATS.includes(c)) return 'receita'
  if (['Pró-labore','Salários','13° Salário'].includes(c)) return 'pessoal'
  if (['Simples Nacional','INSS','IRRF','FGTS'].includes(c)) return 'imposto'
  return 'operacional'
}
function finNorm(desc, val) {
  if (!desc) return 'Outros'
  let s = String(desc).trim()
  if (val > 0) {
    s = s.replace(/^(pagamento de|pagamento|pagemento|pagamente de|pagamente|pagamdento de|pagamdento|pgto|recebimento de|recebimento|restante do pagamento de|restante do pagamento|restante pagamento|restante|comissão|vídeo|premiação|logo|multa)\s+/i, '').trim()
    const l = s.toLowerCase()
    if (l.includes('center clinica')||l.includes('center clínica')) s='Center Clínica'
    else if (l.includes('thais')||l.includes('thaís')||l.includes('dantas')) s='Thaís Dantas'
    else if (l.includes('analise saude')||l.includes('análise saúde')||l.includes('analise saúde')||l.includes('análise saude')) s='Análise Saúde'
    else if (l==='al'||l.includes('al esportes')||l==='al esporte') s='AL Esportes'
    else if (l.includes('leila')) s='Leila Barros'
    else if (l.includes('bem estar')||l.includes('bem-estar')||l==='farmácia'||l==='farmacia') s='Farmácia Bem Estar'
    else if (l.startsWith('ian')||l==='ian') s='Ian Construção'
    else if (l.includes('ideal')) s='Ideal Modas'
    else if (l.includes('lara')) s='Lara Barbosa'
    else if (l.includes('giulianna')||l.includes('giuliana')) s='Giulianna'
    else if (l.includes('luizyara')) s='Luizyara Torres'
    else if (l.includes('francês')||l.includes('frances')||l.includes('fracês')||l.includes('frânces')) s='Rádio Francês'
    else if (l.includes('liderança')||l.includes('lideraça')) s='Liderança'
    else if (l.includes('cardioclin')) s='CardioClin'
    else if (l.includes('bosk')) s='Bosk'
    else if (l.includes('superlav')) s='SuperLav'
    else if (l.includes('rocha')) s='Rocha Negócios'
    else if (l.includes('quero delivery')||l.includes('quero delivey')) s='Quero Delivery'
    else if (l.includes('fabiano')) s='Fabiano Gomes'
    else if (l.includes('cristal')) s='Cristal'
    else if (l.includes('polidor')) s='Polidor'
    else if (l.includes('diana')) s='Diana'
    else if (l.includes('assertiva')) s='Assertiva'
    else if (l==='cl'||l.includes('cl papelaria')) s='CL Papelaria'
    else if (l.includes('matheus')) s='Matheus - Tráfego'
    else if (l.includes('policlinica')||l.includes('policlínica')) s='Policlínica'
    s = s.replace(/\s+\d+\/\d+$/, '').replace(/\s+última parcela$/, '').replace(/\s+\(extra\)$/, '').trim()
    if (s.length > 0) s = s.charAt(0).toUpperCase() + s.slice(1)
  }
  return s
}
function finBadge(c) { return `fin-badge ${finGrp(c)}` }
function finProcess(raw) {
  const sorted = [...raw].sort((a, b) => new Date(a.date) - new Date(b.date))
  const grouped = {}
  sorted.forEach(t => {
    if (!t.date) return
    const d = new Date(t.date + 'T12:00:00Z')
    const key = `${d.getFullYear()}-${('0' + (d.getMonth() + 1)).slice(-2)}`
    const label = `${FIN_MESES[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`
    if (!grouped[key]) grouped[key] = { key, label, data: [] }
    grouped[key].data.push({ ...t, d: t.date, v: t.value })
  })
  const rawMonths = Object.values(grouped).sort((a, b) => a.key.localeCompare(b.key))
  const monthlyStats = rawMonths.map(m => {
    let rec = 0, desp = 0
    const rows = []
    m.data.forEach(t => { if (t.v > 0) rec += t.v; else desp += t.v; rows.push({ ...t }) })
    let rs = 0; rows.forEach(r => { rs += r.v; r.saldo = rs })
    return { key: m.key, label: m.label, rec, desp, resultado: rec + desp, rows, raw: m.data }
  })
  const catTotals = {}
  const clientTotals = {}
  sorted.forEach(t => { catTotals[t.cat] = (catTotals[t.cat] || 0) + t.value })
  sorted.filter(t => t.value > 0).forEach(t => {
    const name = finNorm(t.desc, t.value)
    if (!clientTotals[name]) clientTotals[name] = { total: 0, count: 0, dates: [] }
    clientTotals[name].total += t.value
    clientTotals[name].count++
    clientTotals[name].dates.push(t.date)
  })
  return { rawMonths, monthlyStats, catTotals, clientTotals }
}

function FinanceiroCompleto() {
  const [loading, setLoading] = useState(true)
  const [loadMsg, setLoadMsg] = useState('Conectando ao banco de dados...')
  const [rawData, setRawData] = useState([])
  const [rawMonths, setRawMonths] = useState([])
  const [monthlyStats, setMonthlyStats] = useState([])
  const [catTotals, setCatTotals] = useState({})
  const [clientTotals, setClientTotals] = useState({})
  const [receivables, setReceivables] = useState([])
  const [payables, setPayables] = useState([])
  const [tab, setTab] = useState('controle')
  const [fcMonth, setFcMonth] = useState(null)
  const [dreMonth, setDreMonth] = useState(null)
  const [txMonth, setTxMonth] = useState('todos')
  const [txTipo, setTxTipo] = useState('todos')
  const [catFilter, setCatFilter] = useState('todos')
  const [txModal, setTxModal] = useState(null)
  const [prevModal, setPrevModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const charts = useRef({})
  const rvCanv = useRef(null), resCanv = useRef(null), mixCanv = useRef(null), despCatCanv = useRef(null)
  const saldoCanv = useRef(null), dreHistCanv = useRef(null)
  const topRecCanv = useRef(null), topDespCanv = useRef(null), cliPieCanv = useRef(null)

  function mkChart(key, canvas, cfg) {
    if (charts.current[key]) { charts.current[key].destroy(); charts.current[key] = null }
    if (!canvas || !window.Chart) return
    charts.current[key] = new window.Chart(canvas, cfg)
  }
  function killChart(key) { if (charts.current[key]) { charts.current[key].destroy(); charts.current[key] = null } }

  async function loadData() {
    setLoading(true); setLoadMsg('Conectando ao banco de dados...')
    try {
      const res = await fetch(`${FIN_API}?action=read_all`)
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Erro ao carregar')
      const raw = result.transactions || []
      const recList = (result.receivables || []).map(r => ({ id: r.id, vencimento: r.vencimento, cliente: r.name, valor: r.valor, categoria: r.categoria }))
      const payList = (result.payables || []).map(p => ({ id: p.id, vencimento: p.vencimento, fornecedor: p.name, valor: p.valor, categoria: p.categoria }))
      const { rawMonths, monthlyStats, catTotals, clientTotals } = finProcess(raw)
      setRawData(raw); setRawMonths(rawMonths); setMonthlyStats(monthlyStats)
      setCatTotals(catTotals); setClientTotals(clientTotals)
      setReceivables(recList); setPayables(payList)
      const lastKey = rawMonths.length ? rawMonths[rawMonths.length - 1].key : null
      setFcMonth(lastKey); setDreMonth(lastKey)
    } catch (e) { console.error(e); notify('Falha ao carregar financeiro: ' + e.message, 'danger') }
    finally { setLoading(false) }
  }
  useEffect(() => { loadData() }, [])

  function calcDRE(key) {
    const m = monthlyStats.find(x => x.key === key)
    if (!m) return { totalRec: 0, pessoal: 0, impostos: 0, gerais: 0, totalDesp: 0, resultado: 0 }
    const sum = cats => m.raw.filter(t => cats.includes(t.cat)).reduce((s, t) => s + t.v, 0)
    const recBas = sum(FIN_REC_CATS)
    const outrasRec = m.raw.filter(t => t.v > 0 && !FIN_REC_CATS.includes(t.cat)).reduce((s, t) => s + t.v, 0)
    const totalRec = recBas + outrasRec
    const pessoal = sum(['Salários','13° Salário','Pró-labore','Lucros Distribuídos'])
    const impostos = sum(['INSS','IRRF','Simples Nacional'])
    const gerais = (Math.abs(m.desp) - Math.abs(pessoal + impostos)) * -1
    return { totalRec, pessoal, impostos, gerais, totalDesp: m.desp, resultado: totalRec + m.desp }
  }

  const cm = useMemo(() => {
    if (!monthlyStats.length) return null
    const now = new Date()
    const curKey = `${now.getFullYear()}-${('0' + (now.getMonth() + 1)).slice(-2)}`
    const key = monthlyStats.some(m => m.key === curKey) ? curKey : monthlyStats[monthlyStats.length - 1].key
    const m = monthlyStats.find(x => x.key === key)
    if (!m) return null
    const realized = m.raw || []
    const recs = receivables.map(r => ({ ...r, status: 'Pendente', matchedTx: null }))
    const pays = payables.map(p => ({ ...p, status: 'Pendente', matchedTx: null }))
    const used = new Set()
    recs.forEach(rec => {
      const matches = realized.filter(t => {
        if (t.v <= 0 || used.has(t.id)) return false
        const nn = finNorm(t.desc, t.v).toLowerCase(), en = rec.cliente.toLowerCase()
        return nn.includes(en) || en.includes(nn)
      })
      if (matches.length > 0) {
        rec.status = matches.reduce((a, t) => a + t.v, 0) >= rec.valor - 150 ? 'Recebido' : 'Recebido Parcial'
        rec.matchedTx = matches[matches.length - 1]; matches.forEach(t => used.add(t.id))
      }
    })
    pays.forEach(pay => {
      const matches = realized.filter(t => {
        if (t.v >= 0 || used.has(t.id)) return false
        const td = t.desc.toLowerCase(), pf = pay.fornecedor.toLowerCase()
        return td.includes(pf) || pf.includes(td)
      })
      if (matches.length > 0) {
        pay.status = matches.reduce((a, t) => a + Math.abs(t.v), 0) >= pay.valor - 150 ? 'Pago' : 'Pago Parcial'
        pay.matchedTx = matches[matches.length - 1]; matches.forEach(t => used.add(t.id))
      }
    })
    const recReal = realized.filter(t => t.v > 0).reduce((s, t) => s + t.v, 0)
    const despReal = realized.filter(t => t.v < 0).reduce((s, t) => s + t.v, 0)
    const recPend = recs.reduce((s, r) => r.status === 'Recebido' ? s : s + r.valor, 0)
    const despPend = pays.reduce((s, p) => p.status === 'Pago' ? s : s + p.valor, 0)
    return { key, label: m.label, recs, pays, realized, recReal, despReal, recPend, despPend, saldoProj: recReal + despReal + recPend - despPend }
  }, [monthlyStats, receivables, payables])

  async function saveTx(form) {
    setSaving(true)
    try {
      const payload = { action: form.id ? 'update' : 'create', date: form.date, desc: form.desc, cat: form.cat, value: parseFloat(form.value) }
      if (form.id) payload.id = form.id
      const r = await (await fetch(FIN_API, { method: 'POST', body: JSON.stringify(payload) })).json()
      if (r.success) { setTxModal(null); await loadData(); notify(form.id ? 'Transacao atualizada com sucesso.' : 'Transacao criada com sucesso.', 'success') } else notify('Erro: ' + r.error, 'danger')
    } catch (e) { notify('Erro: ' + e.message, 'danger') } finally { setSaving(false) }
  }
  async function delTx(id) {
    if (!confirm('Excluir esta transação?')) return
    setSaving(true)
    try {
      const r = await (await fetch(FIN_API, { method: 'POST', body: JSON.stringify({ action: 'delete', id }) })).json()
      if (r.success) { await loadData(); notify('Transacao excluida com sucesso.', 'danger') } else notify('Erro: ' + r.error, 'danger')
    } catch (e) { notify('Erro: ' + e.message, 'danger') } finally { setSaving(false) }
  }
  async function savePrev(form) {
    setSaving(true)
    try {
      const payload = { action: form.id ? 'update' : 'create', sheet: form.tipo, vencimento: parseInt(form.vencimento), name: form.name, categoria: form.cat, valor: parseFloat(form.valor) }
      if (form.id) payload.id = parseInt(form.id)
      const r = await (await fetch(FIN_API, { method: 'POST', body: JSON.stringify(payload) })).json()
      if (r.success) { setPrevModal(null); await loadData(); notify(form.id ? 'Previsao atualizada com sucesso.' : 'Previsao criada com sucesso.', 'success') } else notify('Erro: ' + r.error, 'danger')
    } catch (e) { notify('Erro: ' + e.message, 'danger') } finally { setSaving(false) }
  }
  async function delPrev(id, tipo) {
    if (!confirm('Excluir esta previsão?')) return
    setSaving(true)
    try {
      const r = await (await fetch(FIN_API, { method: 'POST', body: JSON.stringify({ action: 'delete', id: parseInt(id), sheet: tipo }) })).json()
      if (r.success) { await loadData(); notify('Previsao excluida com sucesso.', 'danger') } else notify('Erro: ' + r.error, 'danger')
    } catch (e) { notify('Erro: ' + e.message, 'danger') } finally { setSaving(false) }
  }
  async function fastReceive(cliente, valor, categoria) {
    await saveTx({ date: new Date().toISOString().split('T')[0], desc: `Pagamento ${cliente}`, cat: categoria || 'Receitas com Clientes Pacotes', value: valor })
  }
  async function fastPay(fornecedor, valor, categoria) {
    await saveTx({ date: new Date().toISOString().split('T')[0], desc: fornecedor, cat: categoria || 'Assinaturas', value: -Math.abs(valor) })
  }

  const DK = { grid: { color: 'rgba(255,255,255,0.05)' } }
  useEffect(() => {
    if (tab !== 'visaogeral' || !monthlyStats.length || !window.Chart) return
    const labels = monthlyStats.map(m => m.label)
    mkChart('rv', rvCanv.current, { type: 'bar', data: { labels, datasets: [{ label: 'Receita', data: monthlyStats.map(m => Math.round(m.rec)), backgroundColor: 'rgba(21,199,122,0.2)', borderColor: '#15c77a', borderWidth: 2, borderRadius: 4 }, { label: 'Despesa', data: monthlyStats.map(m => Math.round(Math.abs(m.desp))), backgroundColor: 'rgba(239,96,96,0.2)', borderColor: '#ef6060', borderWidth: 2, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: DK, y: DK } } })
    const rc = monthlyStats.map(m => m.resultado >= 0 ? 'rgba(21,199,122,0.2)' : 'rgba(239,96,96,0.2)')
    const rb = monthlyStats.map(m => m.resultado >= 0 ? '#15c77a' : '#ef6060')
    mkChart('res', resCanv.current, { type: 'bar', data: { labels, datasets: [{ label: 'Resultado', data: monthlyStats.map(m => Math.round(m.resultado)), backgroundColor: rc, borderColor: rb, borderWidth: 2, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: DK, y: DK } } })
    const recCats = Object.entries(catTotals).filter(([, v]) => v > 0)
    mkChart('mix', mixCanv.current, { type: 'doughnut', data: { labels: recCats.map(([c]) => c.slice(0, 15)), datasets: [{ data: recCats.map(([, v]) => Math.round(v)), backgroundColor: ['#15c77a','#3b8fe8','#a983ff','#e4b85d'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } } })
    const dc = Object.entries(catTotals).filter(([c, v]) => v < 0 && c !== 'Lucros Distribuídos').sort((a, b) => a[1] - b[1]).slice(0, 6)
    mkChart('dc', despCatCanv.current, { type: 'bar', data: { labels: dc.map(([c]) => c.slice(0, 18)), datasets: [{ data: dc.map(([, v]) => Math.round(Math.abs(v))), backgroundColor: 'rgba(239,96,96,0.2)', borderColor: '#ef6060', borderWidth: 2, borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: DK, y: { grid: { display: false } } } } })
    return () => { ['rv','res','mix','dc'].forEach(k => killChart(k)) }
  }, [tab, monthlyStats, catTotals])

  useEffect(() => {
    if (tab !== 'fluxo' || !fcMonth || !window.Chart) return
    const m = monthlyStats.find(x => x.key === fcMonth)
    if (!m) return
    const sorted = [...m.rows].sort((a, b) => new Date(a.d) - new Date(b.d))
    mkChart('saldo', saldoCanv.current, { type: 'line', data: { labels: sorted.map(r => finDate(r.d)), datasets: [{ label: 'Saldo', data: sorted.map(r => Math.round(r.saldo)), borderColor: '#3b8fe8', backgroundColor: 'rgba(59,143,232,0.1)', fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: DK } } })
    return () => killChart('saldo')
  }, [tab, fcMonth, monthlyStats])

  useEffect(() => {
    if (tab !== 'dre' || !monthlyStats.length || !window.Chart) return
    const labels = monthlyStats.map(m => m.label)
    const rs = monthlyStats.map(m => calcDRE(m.key).resultado || 0)
    mkChart('dreH', dreHistCanv.current, { type: 'bar', data: { labels, datasets: [{ label: 'Resultado', data: rs.map(v => Math.round(v)), backgroundColor: rs.map(v => v >= 0 ? 'rgba(21,199,122,0.2)' : 'rgba(239,96,96,0.2)'), borderColor: rs.map(v => v >= 0 ? '#15c77a' : '#ef6060'), borderWidth: 2, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: DK } } })
    return () => killChart('dreH')
  }, [tab, monthlyStats])

  useEffect(() => {
    if (tab !== 'categorias' || !Object.keys(catTotals).length || !window.Chart) return
    const tR = Object.entries(catTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const tD = Object.entries(catTotals).filter(([c, v]) => v < 0 && c !== 'Lucros Distribuídos').sort((a, b) => a[1] - b[1]).slice(0, 5)
    mkChart('tR', topRecCanv.current, { type: 'doughnut', data: { labels: tR.map(x => x[0].slice(0, 15)), datasets: [{ data: tR.map(x => Math.round(x[1])), backgroundColor: ['#15c77a','#34d399','#6ee7b7','#a7f3d0','#d1fae5'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right' } } } })
    mkChart('tD', topDespCanv.current, { type: 'bar', data: { labels: tD.map(x => x[0].slice(0, 15)), datasets: [{ data: tD.map(x => Math.round(Math.abs(x[1]))), backgroundColor: 'rgba(239,96,96,0.2)', borderColor: '#ef6060', borderWidth: 2, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { display: false } } } } })
    return () => { killChart('tR'); killChart('tD') }
  }, [tab, catTotals])

  useEffect(() => {
    if (tab !== 'clientes' || !Object.keys(clientTotals).length || !window.Chart) return
    const top10 = Object.entries(clientTotals).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
    mkChart('cliPie', cliPieCanv.current, { type: 'doughnut', data: { labels: top10.map(x => x[0].slice(0, 15)), datasets: [{ data: top10.map(x => Math.round(x[1].total)), backgroundColor: ['#15c77a','#059669','#047857','#3b8fe8','#2563eb','#1d4ed8','#8b5cf6','#7c3aed','#6d28d9','#4c1d95'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } })
    return () => killChart('cliPie')
  }, [tab, clientTotals])

  const txRows = useMemo(() => {
    let rows = txMonth === 'todos' ? [...rawData] : rawData.filter(t => t.date?.startsWith(txMonth))
    if (txTipo === 'receita') rows = rows.filter(r => r.value > 0)
    if (txTipo === 'despesa') rows = rows.filter(r => r.value < 0)
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [rawData, txMonth, txTipo])

  const catEntries = useMemo(() =>
    Object.entries(catTotals).filter(([c, v]) => {
      if (catFilter === 'receita') return v > 0
      if (catFilter === 'despesa') return v < 0 && c !== 'Lucros Distribuídos'
      return c !== 'Lucros Distribuídos'
    }).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])),
  [catTotals, catFilter])
  const maxCat = catEntries.length ? Math.max(...catEntries.map(([, v]) => Math.abs(v))) : 1

  const cliSorted = useMemo(() => Object.entries(clientTotals).sort((a, b) => b[1].total - a[1].total), [clientTotals])
  const maxCli = cliSorted[0]?.[1].total || 1
  const totalRec = monthlyStats.reduce((s, m) => s + m.rec, 0)
  const totalDesp = monthlyStats.reduce((s, m) => s + m.desp, 0)
  const resultado = totalRec + totalDesp
  const best = [...monthlyStats].sort((a, b) => b.rec - a.rec)[0]
  const avgRec = monthlyStats.length ? totalRec / monthlyStats.length : 0
  const fcData = fcMonth ? monthlyStats.find(x => x.key === fcMonth) : null
  const dreData = dreMonth ? calcDRE(dreMonth) : null
  const allCats = [...new Set(rawData.map(t => t.cat))].filter(Boolean)

  const FIN_TABS = [
    { id: 'controle', label: 'Controle Mensal' }, { id: 'visaogeral', label: 'Visão Geral' },
    { id: 'fluxo', label: 'Fluxo de Caixa' }, { id: 'dre', label: 'DRE' },
    { id: 'categorias', label: 'Categorias' }, { id: 'clientes', label: 'Clientes' },
    { id: 'transacoes', label: 'Transações' },
  ]

  if (loading) return (
    <div className="fin-loading">
      <div className="fin-spinner" />
      <p>{loadMsg}</p>
    </div>
  )

  return (
    <section className="page-grid">
      <div className="fin-tabs">
        {FIN_TABS.map(t => <button key={t.id} className={`fin-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
        <div style={{ flex: 1 }} />
        <button className="icon-btn" title="Recarregar" onClick={loadData} style={{ marginRight: 8 }}><RefreshCw size={15} /></button>
      </div>

      {/* CONTROLE MENSAL */}
      {tab === 'controle' && cm && (
        <>
          <div className="fin-kpi-grid">
            <div className="fin-kpi green"><div className="fin-kpi-label">Rec. Realizada</div><div className="fin-kpi-value">{finFmt(cm.recReal)}</div><div className="fin-kpi-sub">{cm.realized.filter(t => t.v > 0).length} recebimentos</div></div>
            <div className="fin-kpi gold"><div className="fin-kpi-label">Rec. Pendente</div><div className="fin-kpi-value">{finFmt(cm.recPend)}</div><div className="fin-kpi-sub">{cm.recs.filter(r => r.status !== 'Recebido').length} pendentes</div></div>
            <div className="fin-kpi red"><div className="fin-kpi-label">Desp. Realizada</div><div className="fin-kpi-value">{finFmt(Math.abs(cm.despReal))}</div><div className="fin-kpi-sub">{cm.realized.filter(t => t.v < 0).length} pagamentos</div></div>
            <div className="fin-kpi gold"><div className="fin-kpi-label">Desp. Pendente</div><div className="fin-kpi-value">{finFmt(cm.despPend)}</div><div className="fin-kpi-sub">{cm.pays.filter(p => p.status !== 'Pago').length} pendentes</div></div>
          </div>
          <div className="fin-kpi-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="fin-kpi" style={{ borderColor: cm.saldoProj >= 0 ? 'rgba(21,199,122,0.3)' : 'rgba(239,96,96,0.3)', background: cm.saldoProj >= 0 ? 'rgba(21,199,122,0.04)' : 'rgba(239,96,96,0.04)' }}>
              <div className="fin-kpi-label">Saldo Projetado — {cm.label}</div>
              <div className="fin-kpi-value" style={{ color: cm.saldoProj >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 28 }}>{finFmt(cm.saldoProj)}</div>
              <div className="fin-kpi-sub">{cm.recs.filter(r => r.status !== 'Pendente').length}/{cm.recs.length} recebidos · {cm.pays.filter(p => p.status !== 'Pendente').length}/{cm.pays.length} pagos</div>
            </div>
          </div>
          <Panel title="Contas a Receber" action="+ Nova" onAction={() => setPrevModal({ tipo: 'Contas a Receber', vencimento: '', name: '', cat: '', valor: '' })}>
            <div className="fin-table-wrap">
              <table className="fin-table">
                <thead><tr><th>Venc.</th><th>Cliente</th><th>Valor</th><th>Status</th><th style={{ textAlign: 'right' }}>Ação</th></tr></thead>
                <tbody>
                  {cm.recs.map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>Dia {r.vencimento}</td>
                      <td style={{ fontWeight: 500 }}>{r.cliente}</td>
                      <td className="fin-val-pos">{finFmt(r.valor)}</td>
                      <td>
                        {r.status === 'Recebido' && <span className="fin-badge receita">✓ Recebido</span>}
                        {r.status === 'Recebido Parcial' && <span className="fin-badge" style={{ background: 'rgba(59,143,232,0.1)', color: 'var(--blue)', border: '1px solid rgba(59,143,232,0.2)' }}>Parcial</span>}
                        {r.status === 'Pendente' && <span className="fin-badge" style={{ background: 'rgba(228,184,93,0.1)', color: 'var(--gold)', border: '1px solid rgba(228,184,93,0.2)' }}>Pendente</span>}
                      </td>
                      <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {r.status === 'Recebido' ? <span style={{ color: 'var(--muted)', fontSize: 11 }}>em {finDate(r.matchedTx?.date)}</span>
                          : <button className="icon-btn" style={{ background: 'rgba(21,199,122,0.1)', color: 'var(--green)', border: '1px solid rgba(21,199,122,0.3)', fontSize: 11, padding: '3px 8px' }} onClick={() => fastReceive(r.cliente, r.valor, r.categoria)}>Receber</button>}
                        <button className="icon-btn" onClick={() => setPrevModal({ tipo: 'Contas a Receber', id: r.id, vencimento: r.vencimento, name: r.cliente, cat: r.categoria, valor: r.valor })}><Pencil size={13} /></button>
                        <button className="icon-btn danger" onClick={() => delPrev(r.id, 'Contas a Receber')}><Trash2 size={13} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Contas a Pagar" action="+ Nova" onAction={() => setPrevModal({ tipo: 'Contas a Pagar', vencimento: '', name: '', cat: '', valor: '' })}>
            <div className="fin-table-wrap">
              <table className="fin-table">
                <thead><tr><th>Venc.</th><th>Fornecedor</th><th>Valor</th><th>Status</th><th style={{ textAlign: 'right' }}>Ação</th></tr></thead>
                <tbody>
                  {cm.pays.map((p, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>Dia {p.vencimento}</td>
                      <td style={{ fontWeight: 500 }}>{p.fornecedor}</td>
                      <td className="fin-val-neg">{finFmt(p.valor)}</td>
                      <td>
                        {p.status === 'Pago' && <span className="fin-badge pessoal">✓ Pago</span>}
                        {p.status === 'Pago Parcial' && <span className="fin-badge" style={{ background: 'rgba(59,143,232,0.1)', color: 'var(--blue)', border: '1px solid rgba(59,143,232,0.2)' }}>Parcial</span>}
                        {p.status === 'Pendente' && <span className="fin-badge" style={{ background: 'rgba(228,184,93,0.1)', color: 'var(--gold)', border: '1px solid rgba(228,184,93,0.2)' }}>Pendente</span>}
                      </td>
                      <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {p.status === 'Pago' ? <span style={{ color: 'var(--muted)', fontSize: 11 }}>em {finDate(p.matchedTx?.date)}</span>
                          : <button className="icon-btn" style={{ background: 'rgba(239,96,96,0.1)', color: 'var(--red)', border: '1px solid rgba(239,96,96,0.3)', fontSize: 11, padding: '3px 8px' }} onClick={() => fastPay(p.fornecedor, p.valor, p.categoria)}>Pagar</button>}
                        <button className="icon-btn" onClick={() => setPrevModal({ tipo: 'Contas a Pagar', id: p.id, vencimento: p.vencimento, name: p.fornecedor, cat: p.categoria, valor: p.valor })}><Pencil size={13} /></button>
                        <button className="icon-btn danger" onClick={() => delPrev(p.id, 'Contas a Pagar')}><Trash2 size={13} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Transações Realizadas no Mês" action="+ Nova" onAction={() => setTxModal({ date: new Date().toISOString().split('T')[0], desc: '', cat: '', value: '' })}>
            <div className="fin-table-wrap">
              <table className="fin-table">
                <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Ações</th></tr></thead>
                <tbody>
                  {cm.realized.map((r, i) => (
                    <tr key={i}>
                      <td>{finDate(r.d)}</td>
                      <td style={{ fontWeight: 500 }}>{r.desc}</td>
                      <td><span className={finBadge(r.cat)}>{r.cat}</span></td>
                      <td className={r.v >= 0 ? 'fin-val-pos' : 'fin-val-neg'}>{r.v >= 0 ? '+' : ''}{finFmt(r.v)}</td>
                      <td>
                        <button className="icon-btn" onClick={() => setTxModal({ id: r.id, date: r.d, desc: r.desc, cat: r.cat, value: r.v })}><Pencil size={13} /></button>
                        <button className="icon-btn danger" onClick={() => delTx(r.id)}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
      {tab === 'controle' && !cm && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>Sem dados disponíveis.</p>}

      {/* VISÃO GERAL */}
      {tab === 'visaogeral' && (
        <>
          <div className="fin-kpi-grid">
            <div className="fin-kpi green"><div className="fin-kpi-label">Receita Total</div><div className="fin-kpi-value">{finShort(totalRec)}</div></div>
            <div className="fin-kpi red"><div className="fin-kpi-label">Despesa Total</div><div className="fin-kpi-value">{finShort(Math.abs(totalDesp))}</div></div>
            <div className={`fin-kpi ${resultado >= 0 ? 'green' : 'red'}`}><div className="fin-kpi-label">Resultado</div><div className="fin-kpi-value">{finShort(resultado)}</div><div className="fin-kpi-sub">{resultado >= 0 ? 'positivo' : 'negativo'}</div></div>
            <div className="fin-kpi blue"><div className="fin-kpi-label">Ticket Médio</div><div className="fin-kpi-value">{finShort(avgRec)}</div></div>
            <div className="fin-kpi gold"><div className="fin-kpi-label">Melhor Mês</div><div className="fin-kpi-value" style={{ fontSize: 18 }}>{best?.label || '—'}</div></div>
          </div>
          <div className="fin-charts-2">
            <div className="fin-chart-card"><h3>Receita vs Despesa</h3><div className="fin-chart-wrap"><canvas ref={rvCanv} /></div></div>
            <div className="fin-chart-card"><h3>Resultado Mensal</h3><div className="fin-chart-wrap"><canvas ref={resCanv} /></div></div>
            <div className="fin-chart-card"><h3>Mix de Receitas</h3><div className="fin-chart-wrap"><canvas ref={mixCanv} /></div></div>
            <div className="fin-chart-card"><h3>Despesas por Categoria</h3><div className="fin-chart-wrap"><canvas ref={despCatCanv} /></div></div>
          </div>
        </>
      )}

      {/* FLUXO DE CAIXA */}
      {tab === 'fluxo' && (
        <>
          <div className="fin-month-filter">
            {rawMonths.map(m => <button key={m.key} className={`fin-month-btn${fcMonth === m.key ? ' active' : ''}`} onClick={() => setFcMonth(m.key)}>{m.label}</button>)}
          </div>
          {fcData && (
            <>
              <div className="fin-kpi-grid">
                <div className="fin-kpi green"><div className="fin-kpi-label">Receitas</div><div className="fin-kpi-value">{finFmt(fcData.rec)}</div><div className="fin-kpi-sub">{fcData.rows.filter(r => r.v > 0).length} entradas</div></div>
                <div className="fin-kpi red"><div className="fin-kpi-label">Despesas</div><div className="fin-kpi-value">{finFmt(Math.abs(fcData.desp))}</div><div className="fin-kpi-sub">{fcData.rows.filter(r => r.v < 0).length} saídas</div></div>
                <div className={`fin-kpi ${fcData.resultado >= 0 ? 'green' : 'red'}`}><div className="fin-kpi-label">Resultado</div><div className="fin-kpi-value">{finFmt(fcData.resultado)}</div></div>
                <div className="fin-kpi blue"><div className="fin-kpi-label">Maior Entrada</div><div className="fin-kpi-value">{finFmt(fcData.rows.length ? Math.max(...fcData.rows.map(r => r.v)) : 0)}</div></div>
              </div>
              <div className="fin-chart-card"><h3>Saldo Acumulado — {fcData.label}</h3><div className="fin-chart-wrap" style={{ height: 200 }}><canvas ref={saldoCanv} /></div></div>
              <div className="fin-table-wrap">
                <table className="fin-table">
                  <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Saldo</th></tr></thead>
                  <tbody>
                    {[...fcData.rows].sort((a, b) => new Date(a.d) - new Date(b.d)).map((r, i) => (
                      <tr key={i}>
                        <td>{finDate(r.d)}</td>
                        <td style={{ fontWeight: 500 }}>{r.desc}</td>
                        <td><span className={finBadge(r.cat)}>{r.cat}</span></td>
                        <td className={r.v >= 0 ? 'fin-val-pos' : 'fin-val-neg'}>{r.v >= 0 ? '+' : ''}{finFmt(r.v)}</td>
                        <td style={{ color: r.saldo >= 0 ? 'var(--muted)' : 'var(--red)', fontFamily: 'monospace' }}>{finFmt(r.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* DRE */}
      {tab === 'dre' && (
        <>
          <div className="fin-month-filter">
            {rawMonths.map(m => <button key={m.key} className={`fin-month-btn${dreMonth === m.key ? ' active' : ''}`} onClick={() => setDreMonth(m.key)}>{m.label}</button>)}
          </div>
          <div className="fin-charts-2">
            <div>
              {dreData && (
                <div className="fin-chart-card" style={{ padding: 20 }}>
                  <div className="fin-dre-group">RECEITAS</div>
                  <div className="fin-dre-row"><span>Receita Total</span><span className="fin-val-pos">{finFmt(dreData.totalRec)}</span></div>
                  <div className="fin-dre-total"><span>Total Receitas</span><span className="fin-val-pos">{finFmt(dreData.totalRec)}</span></div>
                  <div className="fin-dre-group" style={{ marginTop: 12 }}>DESPESAS</div>
                  {dreData.pessoal !== 0 && <div className="fin-dre-row"><span>Pessoal (Salários / Pro-labore)</span><span className="fin-val-neg">{finFmt(dreData.pessoal)}</span></div>}
                  {dreData.impostos !== 0 && <div className="fin-dre-row"><span>Impostos</span><span className="fin-val-neg">{finFmt(dreData.impostos)}</span></div>}
                  {dreData.gerais !== 0 && <div className="fin-dre-row"><span>Custos Gerais / Operacionais</span><span className="fin-val-neg">{finFmt(dreData.gerais)}</span></div>}
                  <div className="fin-dre-total"><span>Total Despesas</span><span className="fin-val-neg">{finFmt(dreData.totalDesp)}</span></div>
                  <div className="fin-dre-result"><span>RESULTADO</span><span style={{ color: dreData.resultado >= 0 ? 'var(--green)' : 'var(--red)' }}>{finFmt(dreData.resultado)}</span></div>
                </div>
              )}
            </div>
            <div className="fin-chart-card"><h3>Histórico de Resultado</h3><div className="fin-chart-wrap"><canvas ref={dreHistCanv} /></div></div>
          </div>
          <div className="fin-table-wrap" style={{ overflowX: 'auto', marginTop: 16 }}>
            <table className="fin-table">
              <thead><tr><th>Item</th>{monthlyStats.map(m => <th key={m.key}>{m.label}</th>)}</tr></thead>
              <tbody>
                {[{k:'totalRec',l:'Receita'},{k:'pessoal',l:'Pessoal'},{k:'impostos',l:'Impostos'},{k:'gerais',l:'Desp. Gerais'},{k:'resultado',l:'Resultado'}].map(({ k, l }) => (
                  <tr key={k}>
                    <td style={{ fontWeight: 500 }}>{l}</td>
                    {monthlyStats.map(ms => {
                      const v = calcDRE(ms.key)[k] || 0
                      const cls = k === 'totalRec' ? 'fin-val-pos' : k === 'resultado' ? (v >= 0 ? 'fin-val-pos' : 'fin-val-neg') : v < 0 ? 'fin-val-neg' : ''
                      return <td key={ms.key} className={cls}>{finShort(v)}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* CATEGORIAS */}
      {tab === 'categorias' && (
        <>
          <div className="fin-month-filter">
            {['todos','receita','despesa'].map(f => <button key={f} className={`fin-month-btn${catFilter === f ? ' active' : ''}`} onClick={() => setCatFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}
          </div>
          <div className="fin-charts-2">
            <div className="fin-chart-card"><h3>Top Receitas</h3><div className="fin-chart-wrap"><canvas ref={topRecCanv} /></div></div>
            <div className="fin-chart-card"><h3>Top Despesas</h3><div className="fin-chart-wrap"><canvas ref={topDespCanv} /></div></div>
          </div>
          <div style={{ marginTop: 16 }}>
            {catEntries.map(([cat, val]) => {
              const pct = Math.round((Math.abs(val) / maxCat) * 100)
              const color = val > 0 ? 'var(--green)' : 'var(--red)'
              return (
                <div key={cat} className="fin-prog-row">
                  <div className="fin-prog-label">
                    <span><span className={finBadge(cat)} style={{ marginRight: 8 }}>{cat}</span></span>
                    <span style={{ color, fontFamily: 'monospace', fontWeight: 500 }}>{finFmt(val)}</span>
                  </div>
                  <div className="fin-prog-track"><div className="fin-prog-fill" style={{ width: `${pct}%`, background: color }} /></div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* CLIENTES */}
      {tab === 'clientes' && (
        <>
          <div className="fin-kpi-grid">
            <div className="fin-kpi blue"><div className="fin-kpi-label">Clientes Únicos</div><div className="fin-kpi-value">{Object.keys(clientTotals).length}</div></div>
            <div className="fin-kpi green"><div className="fin-kpi-label">Top Cliente</div><div className="fin-kpi-value" style={{ fontSize: 18 }}>{cliSorted[0]?.[0] || '—'}</div></div>
            <div className="fin-kpi gold">
              <div className="fin-kpi-label">Ticket Médio</div>
              <div className="fin-kpi-value">{(() => { const vs = Object.values(clientTotals); const t = vs.reduce((s, c) => s + c.total, 0); const n = vs.reduce((s, c) => s + c.count, 0); return finShort(n ? t / n : 0) })()}</div>
            </div>
          </div>
          <div className="fin-charts-2">
            <div>
              {cliSorted.slice(0, 10).map(([name, data]) => {
                const pct = Math.round((data.total / maxCli) * 100)
                return (
                  <div key={name} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 500, marginBottom: 6 }}>{name}</div><div className="fin-prog-track"><div className="fin-prog-fill" style={{ width: `${pct}%`, background: 'var(--green)' }} /></div></div>
                    <div style={{ color: 'var(--muted)', fontFamily: 'monospace', minWidth: 30 }}>{data.count}x</div>
                    <div className="fin-val-pos">{finShort(data.total)}</div>
                  </div>
                )
              })}
            </div>
            <div className="fin-chart-card"><h3>Participação por Cliente</h3><div className="fin-chart-wrap"><canvas ref={cliPieCanv} /></div></div>
          </div>
          <div className="fin-table-wrap" style={{ marginTop: 16 }}>
            <table className="fin-table">
              <thead><tr><th>Cliente</th><th>Qtd</th><th>Total</th><th>Ticket Médio</th><th>Primeiro</th><th>Último</th></tr></thead>
              <tbody>
                {cliSorted.slice(0, 25).map(([name, data]) => {
                  const dates = data.dates.filter(Boolean).sort()
                  return (
                    <tr key={name}>
                      <td style={{ fontWeight: 500 }}>{name}</td>
                      <td style={{ color: 'var(--blue)' }}>{data.count}</td>
                      <td className="fin-val-pos">{finFmt(data.total)}</td>
                      <td style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{finFmt(data.total / data.count)}</td>
                      <td>{finDate(dates[0])}</td>
                      <td>{finDate(dates[dates.length - 1])}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TRANSAÇÕES */}
      {tab === 'transacoes' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="fin-month-filter" style={{ flex: 1, flexWrap: 'wrap', marginBottom: 0 }}>
              <button className={`fin-month-btn${txMonth === 'todos' ? ' active' : ''}`} onClick={() => setTxMonth('todos')}>Todos</button>
              {rawMonths.map(m => <button key={m.key} className={`fin-month-btn${txMonth === m.key ? ' active' : ''}`} onClick={() => setTxMonth(m.key)}>{m.label}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['todos','receita','despesa'].map(t => <button key={t} className={`fin-month-btn${txTipo === t ? ' active' : ''}`} onClick={() => setTxTipo(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
            </div>
            <button className="primary" style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setTxModal({ date: new Date().toISOString().split('T')[0], desc: '', cat: '', value: '' })}><Plus size={14} /> Nova</button>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>{txRows.length} transações</div>
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Ações</th></tr></thead>
              <tbody>
                {txRows.map((r, i) => (
                  <tr key={i}>
                    <td>{finDate(r.date)}</td>
                    <td style={{ fontWeight: 500 }}>{r.desc}</td>
                    <td><span className={finBadge(r.cat)}>{r.cat}</span></td>
                    <td className={r.value >= 0 ? 'fin-val-pos' : 'fin-val-neg'}>{r.value >= 0 ? '+' : ''}{finFmt(r.value)}</td>
                    <td>
                      <button className="icon-btn" onClick={() => setTxModal({ id: r.id, date: r.date, desc: r.desc, cat: r.cat, value: r.value })}><Pencil size={13} /></button>
                      <button className="icon-btn danger" onClick={() => delTx(r.id)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL: Transação */}
      {txModal && (
        <div className="fin-modal-overlay" onClick={() => setTxModal(null)}>
          <div className="fin-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>{txModal.id ? 'Editar Transação' : 'Nova Transação'}</h3>
              <button className="icon-btn" onClick={() => setTxModal(null)}><X size={16} /></button>
            </div>
            <datalist id="fin-cats-list">{allCats.map(c => <option key={c} value={c} />)}</datalist>
            <div className="form-grid">
              <label className="field"><span>Data</span><input type="date" value={txModal.date} onChange={e => setTxModal({ ...txModal, date: e.target.value })} /></label>
              <label className="field"><span>Descrição</span><input type="text" value={txModal.desc} onChange={e => setTxModal({ ...txModal, desc: e.target.value })} /></label>
              <label className="field"><span>Categoria</span><input type="text" list="fin-cats-list" value={txModal.cat} onChange={e => setTxModal({ ...txModal, cat: e.target.value })} /></label>
              <label className="field"><span>Valor (negativo = despesa)</span><input type="number" step="0.01" value={txModal.value} onChange={e => setTxModal({ ...txModal, value: e.target.value })} /></label>
              <button className="primary span" disabled={saving} onClick={() => saveTx(txModal)}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Conta Prevista */}
      {prevModal && (
        <div className="fin-modal-overlay" onClick={() => setPrevModal(null)}>
          <div className="fin-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>{prevModal.id ? `Editar ${prevModal.tipo}` : `Nova ${prevModal.tipo}`}</h3>
              <button className="icon-btn" onClick={() => setPrevModal(null)}><X size={16} /></button>
            </div>
            <div className="form-grid">
              <label className="field"><span>Dia do Vencimento</span><input type="number" min="1" max="31" value={prevModal.vencimento} onChange={e => setPrevModal({ ...prevModal, vencimento: e.target.value })} /></label>
              <label className="field"><span>{prevModal.tipo === 'Contas a Receber' ? 'Cliente' : 'Fornecedor'}</span><input type="text" value={prevModal.name} onChange={e => setPrevModal({ ...prevModal, name: e.target.value })} /></label>
              <label className="field"><span>Categoria</span><input type="text" list="fin-cats-list" value={prevModal.cat} onChange={e => setPrevModal({ ...prevModal, cat: e.target.value })} /></label>
              <label className="field"><span>Valor</span><input type="number" step="0.01" value={prevModal.valor} onChange={e => setPrevModal({ ...prevModal, valor: e.target.value })} /></label>
              <button className="primary span" disabled={saving} onClick={() => savePrev(prevModal)}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Financeiro({ state, addItem, updateItem, metrics }) {
  const firstClient = state.clients[0]
  const [form, setForm] = useState({ client_id: firstClient?.id || '', client: firstClient?.name || '', due: firstClient?.payment_due || '2026-06-05', value: firstClient?.monthly || 6200, status: 'A receber', billing_contact: firstClient?.billing_contact || '', billing_phone: firstClient?.billing_phone || firstClient?.phone || '' })
  const overdue = state.invoices.filter((invoice) => invoice.status !== 'Pago' && new Date(invoice.due) < new Date())
  const selectClient = (clientName) => {
    const client = state.clients.find((item) => item.name === clientName)
    setForm({
      ...form,
      client_id: client?.id || '',
      client: clientName,
      due: client?.payment_due || form.due,
      value: client?.monthly || form.value,
      billing_contact: client?.billing_contact || '',
      billing_phone: client?.billing_phone || client?.phone || '',
    })
  }
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
          <Select label="Cliente" value={form.client} onChange={selectClient} options={state.clients.map((c) => c.name)} />
          <Input label="Vencimento" type="date" value={form.due} onChange={(due) => setForm({ ...form, due })} />
          <Input label="Valor" type="number" value={form.value} onChange={(value) => setForm({ ...form, value })} />
          <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={['A receber', 'Pago', 'Atrasado']} />
          <Input label="Contato cobrança" value={form.billing_contact} onChange={(billing_contact) => setForm({ ...form, billing_contact })} />
          <Input label="WhatsApp cobrança" value={form.billing_phone} onChange={(billing_phone) => setForm({ ...form, billing_phone })} />
          <button className="primary span" onClick={() => addItem('invoices', form)}><Plus size={16} /> Adicionar cobrança</button>
        </div>
      </Panel>
      <Panel title="Recebíveis">
        <DataTable columns={['Cliente', 'Vencimento', 'Valor', 'Contato', 'Status', 'Ações']} rows={state.invoices.map((i) => [
          i.client,
          date(i.due),
          money(i.value),
          i.billing_contact || i.billing_phone || '-',
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
  const [driveFolder, setDriveFolder] = useState(null)
  const [driveItems, setDriveItems] = useState([])
  const [drivePath, setDrivePath] = useState([])
  const [driveBrowserMsg, setDriveBrowserMsg] = useState('')
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
    if (driveConn) loadDriveFolder()
  }, [driveConn?.root_folder_id])
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

  const loadDriveFolder = async (folderId, pushPath = false) => {
    setDriveBrowserMsg('Carregando pasta...')
    const res = await drive.listFolder(folderId)
    if (res.ok) {
      setDriveFolder(res.folder)
      setDriveItems(res.files || [])
      setDriveBrowserMsg('')
      if (pushPath) setDrivePath((current) => [...current, res.folder])
      else if (!folderId) setDrivePath([res.folder])
    } else setDriveBrowserMsg(`Erro ao listar pasta: ${res.error}`)
  }

  const enterDriveFolder = (item) => {
    if (!item?.isFolder) return
    loadDriveFolder(item.id, true)
  }

  const goRootDriveFolder = () => {
    setDrivePath([])
    loadDriveFolder()
  }

  const goUpDriveFolder = () => {
    if (drivePath.length <= 1) return goRootDriveFolder()
    const nextPath = drivePath.slice(0, -1)
    setDrivePath(nextPath)
    loadDriveFolder(nextPath[nextPath.length - 1]?.id)
  }

  const linkFolderToClient = async (item) => {
    if (!selectedClient?.id || !item?.isFolder) return
    setBusy(true); setDriveBrowserMsg(`Vinculando "${item.name}" ao cliente...`)
    const res = await drive.linkClientFolder(selectedClient.id, item.id)
    setBusy(false)
    if (res.ok) {
      updateItem('clients', selectedClient.id, { ...selectedClient, drive_folder_id: res.folderId, drive_folder_url: res.folderUrl })
      setDriveBrowserMsg(`Pasta "${item.name}" vinculada a ${selectedClient.name}.`)
    } else setDriveBrowserMsg(`Erro ao vincular pasta: ${res.error}`)
  }

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
        <p className="muted-note">Conecte a conta principal da agência para criar pastas por cliente, organizar projetos de vídeo e enviar arquivos diretamente para a pasta raiz compartilhada.</p>
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

          <Panel title="Pasta raiz do Drive" action="Atualizar" onAction={() => loadDriveFolder(driveFolder?.id)}>
            <div className="drive-browser-head">
              <div>
                <strong>{driveFolder?.name || 'DBE Apresentações'}</strong>
                <span>{driveItems.length} item(ns) nesta pasta</span>
              </div>
              <div className="button-row compact no-margin">
                <button className="secondary" onClick={goRootDriveFolder}><FolderOpen size={13} /> Raiz</button>
                <button className="secondary" onClick={goUpDriveFolder} disabled={drivePath.length <= 1}>Voltar</button>
              </div>
            </div>
            {driveBrowserMsg && <p className="muted-note" style={{ marginTop: 8 }}>{driveBrowserMsg}</p>}
            <div className="drive-file-list">
              {driveItems.length ? driveItems.map((item) => (
                <div className="drive-file-row" key={item.id}>
                  <button className="drive-file-main" onClick={() => item.isFolder ? enterDriveFolder(item) : window.open(item.url, '_blank')}>
                    {item.isFolder ? <FolderOpen size={16} /> : <FileText size={16} />}
                    <span>
                      <strong>{item.name}</strong>
                      <small>{driveItemMeta(item)}</small>
                    </span>
                  </button>
                  <div className="row-actions">
                    {item.isFolder && selectedClient && (
                      <button className="icon-btn" title="Usar como pasta do cliente" onClick={() => linkFolderToClient(item)} disabled={busy}>
                        <Check size={14} />
                      </button>
                    )}
                    <a className="icon-btn" title="Abrir no Drive" href={item.url} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )) : <div className="empty-box">Nenhum item encontrado nessa pasta.</div>}
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

function Configuracoes({ currentUser, onProfileUpdate, onLogout, theme, setTheme }) {
  const [tab, setTab] = useState('perfil')
  const [name, setName] = useState(currentUser?.name || '')
  const [pass, setPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [passMsg, setPassMsg] = useState('')
  const [members, setMembers] = useState(() => getTeamMembers())
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('editor')
  const [newMemberPass, setNewMemberPass] = useState('')
  const [memberMsg, setMemberMsg] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar || '')
  const [profileMsg, setProfileMsg] = useState('')
  const [avatarBusy, setAvatarBusy] = useState(false)
  const avatarInputRef = useRef(null)

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProfileMsg('')
    if (!file.type.startsWith('image/')) {
      setProfileMsg('Selecione um arquivo de imagem.')
      notify('Selecione um arquivo de imagem.', 'danger')
      return
    }
    if (file.size > AVATAR_MAX_FILE_SIZE) {
      setProfileMsg('A imagem precisa ter ate 8 MB.')
      notify('A imagem precisa ter ate 8 MB.', 'danger')
      return
    }
    setAvatarBusy(true)
    try {
      const resized = await resizeAvatarFile(file)
      setAvatarUrl(resized)
      setProfileMsg('Foto carregada. Clique em Salvar perfil para confirmar.')
      notify('Foto carregada. Salve o perfil para confirmar.', 'success')
    } catch (err) {
      const message = err.message || 'Nao foi possivel carregar a foto.'
      setProfileMsg(message)
      notify(message, 'danger')
    } finally {
      setAvatarBusy(false)
      e.target.value = ''
    }
  }

  const saveMembers = (m) => {
    setMembers(m)
    persistTeamMembers(m)
  }

  const saveProfile = () => {
    if (!name.trim()) {
      setProfileMsg('Informe um nome de exibicao.')
      notify('Informe um nome de exibicao.', 'danger')
      return
    }
    try {
      const updated = { ...currentUser, name: name.trim(), avatar: avatarUrl || null }
      const nextMembers = getTeamMembers().map((member) =>
        member.email.toLowerCase() === updated.email.toLowerCase()
          ? { ...member, name: updated.name, avatar: updated.avatar }
          : member
      )
      const exists = nextMembers.some((member) => member.email.toLowerCase() === updated.email.toLowerCase())
      const finalMembers = exists ? nextMembers : [...nextMembers, updated]
      saveMembers(finalMembers)
      onProfileUpdate(updated)
      setProfileMsg('Perfil salvo com sucesso.')
      notify('Perfil salvo com sucesso.', 'success')
    } catch (err) {
      const message = err.name === 'QuotaExceededError'
        ? 'Nao foi possivel salvar: o armazenamento do navegador esta cheio.'
        : 'Nao foi possivel salvar o perfil.'
      setProfileMsg(message)
      notify(message, 'danger')
    }
  }

  const changePassword = () => {
    if (pass !== AUTH_PASS) { setPassMsg('Senha atual incorreta'); return }
    if (newPass.length < 6) { setPassMsg('Nova senha precisa ter ao menos 6 caracteres'); return }
    setPassMsg('✅ Senha alterada localmente. Esta versão usa senha compartilhada da equipe.')
  }

  const addMember = () => {
    if (!newMemberEmail || !newMemberName) { setMemberMsg('Preencha nome e e-mail'); return }
    if (newMemberRole === 'editor' && !newMemberPass) { setMemberMsg('Defina uma senha para o editor'); return }
    const exists = members.find(m => m.email === newMemberEmail)
    if (exists) { setMemberMsg('Este e-mail já existe'); return }
    const newEntry = { email: newMemberEmail, name: newMemberName, role: newMemberRole, avatar: null }
    if (newMemberRole === 'editor') newEntry.password = newMemberPass
    saveMembers([...members, newEntry])
    setNewMemberEmail(''); setNewMemberName(''); setNewMemberPass(''); setMemberMsg('✅ Membro adicionado')
    setTimeout(() => setMemberMsg(''), 3000)
  }

  const removeMember = (email) => {
    if (email === currentUser?.email) { setMemberMsg('Não é possível remover a si mesmo'); return }
    saveMembers(members.filter(m => m.email !== email))
  }

  const tabs = [
    { id: 'perfil', label: 'Perfil' },
    { id: 'aparencia', label: 'Aparência' },
    { id: 'membros', label: 'Membros' },
    { id: 'integracoes', label: 'Integrações' },
  ]

  return (
    <section className="page-grid">
      <div className="fin-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`fin-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'perfil' && (
        <div className="grid-2 align-start">
          <Panel title="Informações do perfil">
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'8px 0 16px'}}>
              <div
                className="chat-avatar"
                style={{width:80, height:80, fontSize:28, cursor:'pointer', position:'relative'}}
                onClick={() => avatarInputRef.current?.click()}
                title="Clique para trocar a foto"
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt={name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
                  : (name || currentUser?.name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
                }
              </div>
              <p style={{fontSize:12, color:'var(--muted)', margin:0}}>{avatarBusy ? 'Preparando foto...' : 'Clique na foto para trocar'}</p>
              <input ref={avatarInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarFile} disabled={avatarBusy} />
            </div>
            <div className="form-grid">
              <Input label="Nome de exibição" value={name} onChange={setName} />
              <Input label="E-mail" value={currentUser?.email || ''} onChange={() => {}} />
              <label className="field"><span>Papel</span><input readOnly value={currentUser?.role === 'admin' ? 'Administrador' : 'Editor'} /></label>
            </div>
            {profileMsg && <p className={`inline-notice ${profileMsg.includes('sucesso') || profileMsg.includes('carregada') ? 'success' : 'danger'}`}>{profileMsg}</p>}
            <div className="button-row" style={{marginTop:12}}>
              <button className="primary" onClick={saveProfile} disabled={avatarBusy}>
                <Check size={14} /> Salvar perfil
              </button>
              <button className="secondary" style={{color:'var(--red)'}} onClick={onLogout}>
                <LogOut size={14} /> Sair da conta
              </button>
            </div>
          </Panel>
          <Panel title="Alterar senha">
            <div className="form-grid">
              <Input label="Senha atual" type="password" value={pass} onChange={setPass} />
              <Input label="Nova senha" type="password" value={newPass} onChange={setNewPass} />
            </div>
            {passMsg && <p style={{fontSize:13, marginTop:8, color: passMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)'}}>{passMsg}</p>}
            <button className="primary" style={{marginTop:12}} onClick={changePassword}>
              <Lock size={14} /> Alterar senha
            </button>
          </Panel>
        </div>
      )}

      {tab === 'aparencia' && (
        <Panel title="Tema visual">
          <p className="muted-note">Escolha o tema de exibição do DBE Flow. A preferência é salva no navegador.</p>
          <div style={{display:'flex', gap:12, marginTop:16, flexWrap:'wrap'}}>
            <button
              className={`cfg-theme-btn${theme === 'dark' ? ' active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <Moon size={20} />
              <strong>Escuro</strong>
              <span>Padrão — fundo escuro</span>
            </button>
            <button
              className={`cfg-theme-btn${theme === 'light' ? ' active' : ''}`}
              onClick={() => setTheme('light')}
            >
              <Sun size={20} />
              <strong>Claro</strong>
              <span>Fundo branco e cinza</span>
            </button>
          </div>
        </Panel>
      )}

      {tab === 'membros' && (
        <div className="grid-2 align-start">
          <Panel title="Membros da equipe">
            <div className="stack-list">
              {members.map(m => (
                <div key={m.email} className="list-item">
                  <div className="chat-avatar" style={{width:36, height:36, fontSize:13, flexShrink:0}}>
                    {m.avatar
                      ? <img src={m.avatar} alt={m.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
                      : (m.name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
                    }
                  </div>
                  <div style={{flex:1}}>
                    <strong style={{display:'block', fontSize:14}}>{m.name}</strong>
                    <span style={{fontSize:12, color:'var(--muted)'}}>{m.email} · {m.role === 'admin' ? 'Admin' : 'Editor'}</span>
                  </div>
                  {m.email !== currentUser?.email && (
                    <button className="icon-btn" onClick={() => removeMember(m.email)} title="Remover">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Adicionar membro">
            <div className="form-grid">
              <Input label="Nome" value={newMemberName} onChange={setNewMemberName} />
              <Input label="E-mail" type="email" value={newMemberEmail} onChange={setNewMemberEmail} />
              <label className="field"><span>Papel</span>
                <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)}>
                  <option value="admin">Administrador</option>
                  <option value="editor">Editor</option>
                </select>
              </label>
              {newMemberRole === 'editor' && (
                <Input label="Senha de acesso" type="password" value={newMemberPass} onChange={setNewMemberPass} />
              )}
            </div>
            {memberMsg && <p style={{fontSize:13, marginTop:8, color: memberMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)'}}>{memberMsg}</p>}
            <button className="primary" style={{marginTop:12}} onClick={addMember}>
              <UserPlus size={14} /> Adicionar membro
            </button>
          </Panel>
        </div>
      )}

      {tab === 'integracoes' && <Integracoes />}
    </section>
  )
}

function Integracoes() {
  const [waState, setWaState] = useState('—')
  const [qr, setQr] = useState('')
  const [waMsg, setWaMsg] = useState('')
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
  const configureWaWebhook = async () => {
    setBusy(true); setWaMsg('')
    const webhookUrl = `${window.location.origin}/api/whatsapp-webhook`
    const res = await whatsapp.setWebhook(webhookUrl)
    setBusy(false)
    setWaMsg(res.ok ? `Webhook configurado: ${webhookUrl}` : `Erro ao configurar webhook: ${res.error}`)
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
              <p className="muted-note">Conta principal conectada: <strong>{driveConn.google_account_email}</strong>.</p>
              <p className="muted-note">Pasta raiz: <code>1-rHJ3bfsx4mvG6xXTpKiCtn1a1_R1Gg0</code></p>
              <div className="button-row" style={{ marginTop: 8 }}>
                <button className="secondary" onClick={() => drive.startAuth()}><RefreshCw size={16} /> Reconectar</button>
              </div>
            </>
          ) : (
            <>
              <p className="muted-note">Conecte a conta principal da agência. A pasta raiz precisa estar compartilhada com essa conta como Editor.</p>
              <p className="muted-note" style={{ color: 'var(--warning, #f59e0b)', marginTop: 4 }}>Certifique-se de configurar <strong>GOOGLE_CLIENT_SECRET</strong> e reconectar após liberar a pasta no Drive.</p>
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
            <button className="secondary" onClick={configureWaWebhook} disabled={busy}>Configurar webhook</button>
          </div>
          <p className="muted-note">Status atual: <strong>{waState}</strong></p>
          {waMsg && <p className="muted-note">{waMsg}</p>}
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

function Modal({ title, open, onClose, children, wide = false }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={wide ? 'modal-panel wide' : 'modal-panel'}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

function MiniStat({ label, value, tone = 'blue', onClick }) {
  const toneIcons = { success: TrendingUp, gold: CalendarDays, danger: Activity, blue: Gauge, purple: Sparkles }
  const ToneIcon = toneIcons[tone] || Activity
  return (
    <div
      className={`mini-stat ${tone}${onClick ? ' clickable' : ''}`}
      onClick={onClick}
      style={onClick ? {cursor:'pointer'} : undefined}
      title={onClick ? 'Clique para ver detalhes' : undefined}
    >
      <div className="mini-stat-head">
        <span>{label}</span>
        <em className="mini-stat-icon"><ToneIcon size={15} /></em>
      </div>
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

function Avatar({ contact }) {
  return contact?.profile_pic
    ? <img className="chat-avatar" src={contact.profile_pic} alt={contact.name || 'Contato'} />
    : <span className="chat-avatar">{initials(contact?.name || 'DBE')}</span>
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

function StatusFunnel({ stages, counts }) {
  const max = Math.max(1, ...stages.map((stage) => counts[stage] || 0))
  return (
    <div className="pipeline status-funnel">
      {stages.map((stage) => {
        const count = counts[stage] || 0
        return <div key={stage}><span>{stage}</span><strong>{count}</strong><i style={{ width: `${Math.max(10, (count / max) * 100)}%` }} /></div>
      })}
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

function emptyContentForm(clients = [], client) {
  const selected = client || clients[0]
  return {
    client_id: selected?.id || '',
    client: selected?.name || '',
    title: '',
    format: 'Roteiro de Reels',
    status: 'Ideia',
    responsible: selected?.owner || 'DBE',
    delivery_date: '',
    post_date: '',
    cover_date: '',
    reference_url: '',
    caption: '',
    priority: 'Média',
    media_files: '',
    notes: '',
    source: 'cronograma',
    createdAt: '',
    updatedAt: '',
  }
}

function normalizeContentItem(item, clients = []) {
  const client = clients.find((row) => row.id === item.client_id) || clients.find((row) => row.name === item.client)
  return {
    ...item,
    client_id: item.client_id || client?.id || '',
    client: item.client || client?.name || 'Sem cliente',
    title: item.title || item.caption || 'Sem título',
    format: item.format || inferContentFormat(item),
    status: normalizeContentStatus(item.status),
    responsible: item.responsible || item.owner || 'DBE',
    delivery_date: item.delivery_date || item.due || '',
    post_date: item.post_date || item.date?.slice?.(0, 10) || '',
    cover_date: item.cover_date || '',
    reference_url: item.reference_url || item.reference || '',
    caption: item.caption || item.cta || '',
    priority: item.priority || 'Média',
    media_files: item.media_files || item.media || '',
    notes: item.notes || item.body || '',
    source: item.source || 'roteiros',
    createdAt: item.createdAt || item.created_at || '',
    updatedAt: item.updatedAt || item.updated_at || '',
  }
}

function inferContentFormat(item) {
  if (item.network === 'Reels') return 'Reels'
  if (item.network === 'Stories') return 'Stories'
  if (item.pillar || item.hook || item.body) return 'Roteiro de Reels'
  return 'Ideia solta'
}

function normalizeContentStatus(status = '') {
  const normalized = normalizeStatus(status)
  if (['rascunho', 'ideia'].includes(normalized)) return 'Ideia'
  if (['a produzir', 'gravado'].includes(normalized)) return 'A produzir'
  if (['em produção', 'producao', 'produção', 'em edição', 'em edicao'].includes(normalized)) return 'Em produção'
  if (['roteiro pronto', 'editado'].includes(normalized)) return 'Roteiro pronto'
  if (['arte em criação', 'arte em criacao'].includes(normalized)) return 'Arte em criação'
  if (['aprovando', 'revisão', 'revisao', 'em revisão', 'em revisao'].includes(normalized)) return 'Aprovando'
  if (['aprovado', 'aprovada', 'falta agendamento', 'agendado'].includes(normalized)) return 'Aprovado'
  if (['postado', 'publicado'].includes(normalized)) return 'Postado'
  if (['pausado'].includes(normalized)) return 'Pausado'
  if (['cancelado', 'reprovado', 'reprovada'].includes(normalized)) return 'Cancelado'
  return CONTENT_STATUSES.includes(status) ? status : 'Ideia'
}

function contentMatchesFilters(item, filters, clients) {
  const client = clients.find((row) => row.id === item.client_id) || clients.find((row) => row.name === item.client)
  const query = filters.query.trim().toLowerCase()
  if (query && !JSON.stringify({ ...item, client: client?.name || item.client }).toLowerCase().includes(query)) return false
  if (filters.client !== 'Todos' && item.client !== filters.client && client?.name !== filters.client) return false
  if (filters.format !== 'Todos' && item.format !== filters.format) return false
  if (filters.status !== 'Todos' && item.status !== filters.status) return false
  if (filters.responsible !== 'Todos' && item.responsible !== filters.responsible) return false
  if (filters.priority !== 'Todos' && item.priority !== filters.priority) return false
  if (filters.month !== 'Todos' && ![item.delivery_date, item.post_date, item.cover_date].some((value) => value?.startsWith?.(filters.month))) return false
  return true
}

function contentBelongsToClient(item, client) {
  return item.client_id === client.id || item.client === client.name
}

function isArchivedClient(client) {
  return ['Pausado', 'Arquivado', 'Inativo', 'Cancelado'].includes(client.status)
}

function unique(items) {
  return [...new Set(items.filter(Boolean))]
}

function formatMonth(month) {
  return format(new Date(`${month}-02T12:00:00`), 'MM/yyyy')
}

function formatTone(formatName) {
  const map = {
    Reels: 'danger',
    'Roteiro de Reels': 'blue',
    'Post estático': 'gold',
    Carrossel: 'success',
    Stories: 'blue',
    Legenda: 'gold',
    'Ideia solta': 'default',
    Campanha: 'danger',
    Outro: 'default',
  }
  return map[formatName] || 'default'
}

function statusTone(status) {
  const map = {
    Ideia: 'default',
    'A produzir': 'gold',
    'Em produção': 'blue',
    'Roteiro pronto': 'success',
    'Arte em criação': 'blue',
    Aprovando: 'gold',
    Aprovado: 'success',
    Postado: 'success',
    Pausado: 'default',
    Cancelado: 'danger',
  }
  return map[status] || 'default'
}

function priorityTone(priority) {
  return { Baixa: 'blue', Média: 'gold', Alta: 'danger', Urgente: 'danger' }[priority] || 'default'
}

function countScriptStages(scripts = [], posts = []) {
  const counts = {
    Ideias: 0,
    Gravados: 0,
    'Em edição': 0,
    Editados: 0,
    Revisão: 0,
    Aprovados: 0,
    'Falta agendamento': 0,
    Agendados: posts.filter((post) => post.status === 'Agendado').length,
    Reprovados: 0,
  }
  scripts.forEach((script) => {
    const status = normalizeStatus(script.status)
    if (['ideia', 'rascunho', 'a produzir'].includes(status)) counts.Ideias += 1
    else if (status === 'gravado') counts.Gravados += 1
    else if (['em edicao', 'em edição', 'producao', 'produção', 'em produção', 'arte em criação', 'arte em criacao'].includes(status)) counts['Em edição'] += 1
    else if (['editado', 'roteiro pronto'].includes(status)) counts.Editados += 1
    else if (['revisao', 'revisão', 'em revisao', 'em revisão', 'aprovando'].includes(status)) counts.Revisão += 1
    else if (['aprovado', 'aprovada'].includes(status)) {
      counts.Aprovados += 1
      counts['Falta agendamento'] += 1
    } else if (status === 'falta agendamento') counts['Falta agendamento'] += 1
    else if (['agendado', 'postado', 'publicado'].includes(status)) counts.Agendados += 1
    else if (['reprovado', 'reprovada', 'cancelado'].includes(status)) counts.Reprovados += 1
    else counts.Ideias += 1
  })
  return counts
}

function countArtStages(posts = []) {
  const counts = {
    'Ideias aprovadas': 0,
    'Faltam fazer': 0,
    Feitas: 0,
    Aprovadas: 0,
    'Falta agendamento': 0,
    Agendados: 0,
    Reprovadas: 0,
  }
  posts.forEach((post) => {
    const status = normalizeStatus(post.status)
    if (['ideia aprovada', 'ideias aprovadas', 'aprovacao pauta', 'aprovação pauta'].includes(status)) counts['Ideias aprovadas'] += 1
    else if (['faltam fazer', 'falta fazer', 'producao', 'produção'].includes(status)) counts['Faltam fazer'] += 1
    else if (['feita', 'feito', 'editado', 'editada'].includes(status)) counts.Feitas += 1
    else if (['aprovado', 'aprovada'].includes(status)) {
      counts.Aprovadas += 1
      counts['Falta agendamento'] += 1
    } else if (status === 'falta agendamento') counts['Falta agendamento'] += 1
    else if (status === 'agendado') counts.Agendados += 1
    else if (['reprovado', 'reprovada'].includes(status)) counts.Reprovadas += 1
    else if (['revisao', 'revisão', 'em revisao', 'em revisão'].includes(status)) counts.Feitas += 1
    else counts['Faltam fazer'] += 1
  })
  return counts
}

function normalizeStatus(value = '') {
  return String(value).trim().toLowerCase()
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

function nextPaymentDate(day) {
  const now = new Date()
  const dueDay = Math.min(28, Math.max(1, Number(day || 5)))
  const next = new Date(now.getFullYear(), now.getMonth(), dueDay)
  if (next < now) next.setMonth(next.getMonth() + 1)
  return format(next, 'yyyy-MM-dd')
}

function dateTime(value) {
  return value ? format(new Date(value), 'dd/MM HH:mm') : '-'
}

function driveItemMeta(item) {
  const type = item.isFolder ? 'Pasta' : 'Arquivo'
  const size = item.size ? ` · ${(Number(item.size) / 1024 / 1024).toFixed(1)} MB` : ''
  const modified = item.modifiedTime ? ` · ${dateTime(item.modifiedTime)}` : ''
  return `${type}${size}${modified}`
}

function normalizeMediaFiles(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {}
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ name: line, url: line.startsWith('http') ? line : '' }))
  }
  return []
}

function mediaFilesToText(value) {
  if (!value) return ''
  if (Array.isArray(value)) {
    return value.map((file) => file.url ? `${file.name || file.url} - ${file.url}` : (file.name || '')).filter(Boolean).join('\n')
  }
  return String(value)
}

function normalizeVideoReviews(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }
  return []
}

function getVideoReview(item, fileId) {
  if (!fileId) return null
  return normalizeVideoReviews(item?.video_reviews).find((review) => review.fileId === fileId) || null
}

function reviewLabel(status) {
  const labels = {
    approved: 'Aprovado',
    changes_requested: 'Ajustes solicitados',
    commented: 'Comentado',
  }
  return labels[status] || ''
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
  const greeting = invoice.billing_contact || invoice.client
  return `Olá ${greeting}, tudo bem?\n\nPassando para lembrar da cobrança DBE de ${invoice.client}, com vencimento em ${date(invoice.due)}, no valor de ${money(invoice.value)}.\n\nSe já tiver realizado, pode desconsiderar.`
}

createRoot(document.getElementById('root')).render(<App />)
