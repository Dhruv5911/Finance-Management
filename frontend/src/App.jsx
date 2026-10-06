import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import './index.css'
import './App.css'

// Views
import Dashboard from './views/Dashboard'
import ChatView from './views/ChatView'
import Transactions from './views/Transactions'
import Analytics from './views/Analytics'
import BudgetPlanner from './views/BudgetPlanner'
import SavingsGoal from './views/SavingsGoal'
import LoanEMI from './views/LoanEMI'
import Investment from './views/Investment'
import CurrencyConverter from './views/CurrencyConverter'
import AIInsights from './views/AIInsights'

// Components
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Landing from './screens/Landing'
import AuthScreen from './screens/AuthScreen'
import Toast from './components/Toast'
import UploadModal from './components/UploadModal'

// Context
export const AppContext = createContext(null)

export function useApp() { return useContext(AppContext) }

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'chat', label: 'AI Assistant', icon: 'message', badge: 'Ask' },
  { id: 'transactions', label: 'Transactions', icon: 'list' },
  { id: 'analytics', label: 'Analytics', icon: 'trending' },
  { id: 'budget', label: 'Budget Planner', icon: 'wallet' },
  { id: 'goal', label: 'Savings Goal', icon: 'target' },
  { id: 'loan', label: 'Loan / EMI', icon: 'percent' },
  { id: 'investment', label: 'Investment / SIP', icon: 'arrow-up-right' },
  { id: 'converter', label: 'Currency', icon: 'refresh-cw' },
  { id: 'insights', label: 'AI Insights', icon: 'lightbulb' },
]

export default function App() {
  const [screen, setScreen] = useState('landing') // landing | auth | app
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [user, setUser] = useState(null)
  const [toasts, setToasts] = useState([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [summary, setSummary] = useState({})
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState({})
  const [monthly, setMonthly] = useState([])
  const [dataSource, setDataSource] = useState('sample')
  const [aiStatus, setAiStatus] = useState('checking')

  const addToast = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const refreshData = useCallback(async () => {
    try {
      const [sumRes, txnRes, catRes, monthRes] = await Promise.all([
        fetch('/api/summary'),
        fetch('/api/transactions'),
        fetch('/api/categories'),
        fetch('/api/monthly-summary'),
      ])
      if (sumRes.ok) { const d = await sumRes.json(); setSummary(d); setDataSource(d.source || 'sample') }
      if (txnRes.ok) { const d = await txnRes.json(); setTransactions(d.transactions || []) }
      if (catRes.ok) { const d = await catRes.json(); setCategories(d.categories || {}) }
      if (monthRes.ok) { const d = await monthRes.json(); setMonthly(d.months || []) }
    } catch {}
  }, [])

  const checkAI = useCallback(async () => {
    try {
      const r = await fetch('/api/status')
      if (r.ok) {
        const d = await r.json()
        setAiStatus(d.gemini_status === 'configured' ? 'connected' : 'fallback')
      }
    } catch { setAiStatus('offline') }
  }, [])

  useEffect(() => {
    if (screen === 'app') {
      refreshData()
      checkAI()
    }
  }, [screen, refreshData, checkAI])

  const ctx = {
    screen, setScreen,
    activeView, setActiveView,
    sidebarOpen, setSidebarOpen,
    user, setUser,
    toasts, addToast,
    uploadOpen, setUploadOpen,
    summary, transactions, categories, monthly,
    dataSource, aiStatus,
    refreshData,
    views: VIEWS,
  }

  return (
    <AppContext.Provider value={ctx}>
      {screen === 'landing' && <Landing />}
      {screen === 'auth' && <AuthScreen />}
      {screen === 'app' && <AppShell />}
      <Toast toasts={toasts} />
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} />}
    </AppContext.Provider>
  )
}

function AppShell() {
  const { activeView, sidebarOpen } = useApp()

  const viewMap = {
    dashboard: <Dashboard />,
    chat: <ChatView />,
    transactions: <Transactions />,
    analytics: <Analytics />,
    budget: <BudgetPlanner />,
    goal: <SavingsGoal />,
    loan: <LoanEMI />,
    investment: <Investment />,
    converter: <CurrencyConverter />,
    insights: <AIInsights />,
  }

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main className="app-content">
          {viewMap[activeView] || <Dashboard />}
        </main>
      </div>
    </div>
  )
}
