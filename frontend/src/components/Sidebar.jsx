import React from 'react'
import {
  LayoutGrid, MessageSquare, List, TrendingUp, Wallet, Target, Percent,
  ArrowUpRight, RefreshCw, Lightbulb, Upload, LogOut, Sun, Moon,
} from 'lucide-react'
import { useApp } from '../App'

const ICON_MAP = {
  grid: LayoutGrid,
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

/** Slim floating icon rail (left side), modelled on the Finexy dashboard. */
export default function Sidebar() {
  const { views, activeView, setActiveView, logout, setUploadOpen, theme, setTheme } = useApp()

  return (
    <aside className="rail">
      <div className="rail-pill theme-toggle">
        <button
          className={`rail-btn ${theme === 'light' ? 'on' : ''}`}
          onClick={() => setTheme('light')}
          aria-label="Light theme"
          data-tip="Light"
        >
          <Sun size={19} />
        </button>
        <button
          className={`rail-btn ${theme === 'dark' ? 'on' : ''}`}
          onClick={() => setTheme('dark')}
          aria-label="Dark theme"
          data-tip="Dark"
        >
          <Moon size={19} />
        </button>
      </div>

      <nav className="rail-pill">
        {views.map(v => {
          const Icon = ICON_MAP[v.icon] || LayoutGrid
          return (
            <button
              key={v.id}
              className={`rail-btn ${activeView === v.id ? 'active' : ''}`}
              onClick={() => setActiveView(v.id)}
              aria-label={v.label}
              data-tip={v.label}
            >
              <Icon size={20} />
            </button>
          )
        })}
      </nav>

      <div className="rail-pill grow">
        <button className="rail-btn" onClick={() => setUploadOpen(true)} aria-label="Upload CSV" data-tip="Upload CSV">
          <Upload size={19} />
        </button>
        <button className="rail-btn" onClick={logout} aria-label="Exit" data-tip="Log out">
          <LogOut size={19} />
        </button>
      </div>
    </aside>
  )
}