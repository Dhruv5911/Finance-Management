import React from 'react'
import { LayoutDashboard, MessageSquare, List, TrendingUp, Wallet, Target, Percent, ArrowUpRight, RefreshCw, Lightbulb, Upload, LogOut } from 'lucide-react'
import { useApp } from '../App'

const ICON_MAP = {
  grid: LayoutDashboard,
  message: MessageSquare,
  list: List,
  trending: TrendingUp,
  wallet: Wallet,
  target: Target,
  percent: Percent,
  'arrow-up-right': ArrowUpRight,
  'refresh-cw': RefreshCw,
  lightbulb: Lightbulb,
}

const CORE_VIEWS = ['dashboard', 'chat', 'transactions', 'analytics']
const TOOL_VIEWS = ['budget', 'goal', 'loan', 'investment', 'converter', 'insights']

export default function Sidebar() {
  const { views, activeView, setActiveView, sidebarOpen, setScreen, setUploadOpen, user, transactions } = useApp()

  if (!sidebarOpen) return null

  const renderNav = (ids) =>
    views.filter(v => ids.includes(v.id)).map(v => {
      const Icon = ICON_MAP[v.icon] || LayoutDashboard
      const isActive = activeView === v.id
      return (
        <button
          key={v.id}
          className={`nav-item ${isActive ? 'active' : ''}`}
          onClick={() => setActiveView(v.id)}
        >
          <Icon size={16} className="nav-icon" />
          <span>{v.label}</span>
          {v.badge && <span className="nav-badge">{v.badge}</span>}
          {v.id === 'transactions' && transactions.length > 0 && (
            <span className="nav-count">{transactions.length}</span>
          )}
        </button>
      )
    })

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <span className="sidebar-brand-name">Fin<em>AI</em></span>
      </div>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {user ? user.name[0].toUpperCase() : 'G'}
        </div>
        <div>
          <div className="sidebar-user-name">{user?.name || 'Guest User'}</div>
          <div className="sidebar-user-email">{user?.email || 'guest@finai.local'}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-label">Core Views</span>
          {renderNav(CORE_VIEWS)}
        </div>
        <div className="nav-section">
          <span className="nav-section-label">Finance Tools</span>
          {renderNav(TOOL_VIEWS)}
        </div>
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => setUploadOpen(true)}>
          <Upload size={16} className="nav-icon" />
          <span>Upload CSV</span>
        </button>
        <button className="nav-item" onClick={() => setScreen('landing')}>
          <LogOut size={16} className="nav-icon" />
          <span>Exit</span>
        </button>
      </div>
    </aside>
  )
}
