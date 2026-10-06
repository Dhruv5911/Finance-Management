import React from 'react'
import { Menu, Search, Plus, Bell } from 'lucide-react'
import { useApp } from '../App'

export default function Topbar() {
  const { setSidebarOpen, sidebarOpen, aiStatus, dataSource, setUploadOpen, user, setActiveView } = useApp()

  const statusColor = aiStatus === 'connected' ? 'connected' : aiStatus === 'fallback' ? 'fallback' : 'offline'
  const statusLabel = aiStatus === 'connected' ? 'Gemini AI' : aiStatus === 'fallback' ? 'AI Fallback' : 'Checking…'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="btn-icon" onClick={() => setSidebarOpen(o => !o)} title="Toggle sidebar">
          <Menu size={18} />
        </button>
        <div className="topbar-search">
          <Search size={14} className="topbar-search-icon" />
          <input type="text" placeholder="Search…" readOnly onClick={() => setActiveView('transactions')} />
        </div>
      </div>
      <div className="topbar-right">
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {dataSource === 'sample' ? '📊 Sample data' : `📁 Uploaded`}
        </div>
        <div className="status-dot-wrap">
          <div className={`status-dot ${statusColor}`} />
          <span>{statusLabel}</span>
        </div>
        <button className="btn-primary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => setActiveView('transactions')}>
          <Plus size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          Add Transaction
        </button>
        <div className="user-avatar" title={user?.name || 'Guest'}>
          {user ? user.name[0].toUpperCase() : 'G'}
        </div>
      </div>
    </header>
  )
}
