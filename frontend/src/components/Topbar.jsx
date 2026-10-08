import React from 'react'
import { Search, Bell } from 'lucide-react'
import { useApp } from '../App'

const TABS = ['dashboard', 'chat', 'transactions', 'analytics']
const TAB_LABEL = { dashboard: 'Overview' }

export default function Topbar() {
  const {
    views, activeView, setActiveView, setScreen,
    aiStatus, dataSource, user, transactions,
  } = useApp()

  const statusColor = aiStatus === 'connected' ? 'connected' : aiStatus === 'fallback' ? 'fallback' : 'offline'
  const statusLabel = aiStatus === 'connected' ? 'Gemini AI' : aiStatus === 'fallback' ? 'AI Fallback' : 'Checking…'

  return (
    <header className="topbar">
      <div className="topbar-brand" onClick={() => setScreen('landing')} title="FinAI">
        <div className="topbar-brand-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 17l5-5 4 4 7-8" />
            <path d="M15 8h5v5" />
          </svg>
        </div>
        <span>Fin<em>AI</em></span>
      </div>

      <nav className="topnav">
        {views.filter(v => TABS.includes(v.id)).map(v => (
          <button
            key={v.id}
            className={`topnav-item ${activeView === v.id ? 'active' : ''}`}
            onClick={() => setActiveView(v.id)}
          >
            {TAB_LABEL[v.id] || v.label}
            {v.badge && <span className="topnav-badge">{v.badge}</span>}
            {v.id === 'transactions' && transactions.length > 0 && (
              <span className="topnav-count">{transactions.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="topbar-right">
        <div className="topbar-search">
          <Search size={16} className="topbar-search-icon" />
          <input type="text" placeholder="Search transactions…" readOnly onClick={() => setActiveView('transactions')} />
        </div>
        <div className="topbar-chip hide-md">
          {dataSource === 'uploaded' ? 'Uploaded data' : dataSource === 'manual' ? 'Your data' : 'No data yet'}
        </div>
        <div className="topbar-chip">
          <span className={`status-dot ${statusColor}`} />
          {statusLabel}
        </div>
        <button className="btn-icon" style={{ width: 46, height: 46, background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }} title="Notifications" onClick={() => setActiveView('insights')}>
          <Bell size={18} />
        </button>
        <div className="user-avatar" title={user?.name || 'Guest'}>
          {user ? user.name[0].toUpperCase() : 'G'}
        </div>
      </div>
    </header>
  )
}