import React, { useState } from 'react'
import { useApp } from '../App'

function fmt(v) { return '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }
function pct(v) { return (Number(v) || 0).toFixed(1) + '%' }

const DEFAULT_CATS = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Groceries', 'Bills']

export default function BudgetPlanner() {
  const { categories } = useApp()
  const cats = Object.keys(categories).length ? Object.keys(categories) : DEFAULT_CATS
  const [budgets, setBudgets] = useState(() => Object.fromEntries(cats.map(c => [c, ''])))
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleBudgetChange = (cat, val) => setBudgets(b => ({ ...b, [cat]: val }))

  const handleCheck = async () => {
    const filled = Object.fromEntries(Object.entries(budgets).filter(([, v]) => v && +v > 0).map(([k, v]) => [k, +v]))
    if (!Object.keys(filled).length) { setError('Enter at least one budget amount.'); return }
    setError(''); setLoading(true)
    try {
      const r = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgets: filled }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Budget check failed.'); return }
      setResult(d.results)
    } catch { setError('Network error.') }
    finally { setLoading(false) }
  }

  const STATUS_COLOR = { 'On Track': 'var(--green)', 'Over Budget': 'var(--red)', 'No Data': 'var(--text-muted)' }

  return (
    <div className="view-panel">
      <div className="view-header">
        <div>
          <h1>Budget Planner</h1>
          <p>Set monthly targets per category and compare against actual spending in real time.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><h3>Set Monthly Budgets</h3></div>
        <div className="panel-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            {cats.map(cat => (
              <label key={cat}>
                {cat} (₹)
                <input type="number" placeholder={`Budget for ${cat}`} value={budgets[cat] || ''} onChange={e => handleBudgetChange(cat, e.target.value)} min="0" step="100" />
              </label>
            ))}
          </div>
          <button className="btn-primary" onClick={handleCheck} disabled={loading}>
            {loading ? 'Checking…' : 'Check Budget Status'}
          </button>
        </div>
      </div>

      {result && (
        <div className="result-box" style={{ marginTop: 16 }}>
          <h4>Budget Status</h4>
          {result.map(r => (
            <div key={r.category} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{r.category}</span>
                <span style={{ color: STATUS_COLOR[r.status] || 'var(--text-primary)', fontWeight: 600 }}>{r.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>
                <span>Spent: <strong style={{ color: 'var(--text-primary)' }}>{fmt(r.actual)}</strong></span>
                <span>Budget: <strong style={{ color: 'var(--text-primary)' }}>{fmt(r.budget)}</strong></span>
                <span>Used: <strong>{pct(r.pct_used)}</strong></span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(r.pct_used, 100)}%`, background: r.status === 'Over Budget' ? 'var(--red)' : 'var(--green)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
