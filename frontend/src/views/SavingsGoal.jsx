import React, { useState } from 'react'
import { Target } from 'lucide-react'

function fmt(v) { return '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }

export default function SavingsGoal() {
  const [target, setTarget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [current, setCurrent] = useState('0')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    if (!target || !timeline) { setError('Target amount and timeline are required.'); return }
    setError(''); setLoading(true)
    try {
      const r = await fetch('/api/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_amount: +target, timeline_months: +timeline, current_savings: +(current || 0) }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Goal analysis failed.'); return }
      setResult(d)
    } catch { setError('Network error.') }
    finally { setLoading(false) }
  }

  const pct = result ? Math.min(((+(current || 0)) / +target) * 100, 100) : 0

  return (
    <div className="view-panel">
      <div className="view-header">
        <div>
          <h1>Savings Goal Calculator</h1>
          <p>Project savings milestones based on your actual monthly savings capacity.</p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header"><h3><Target size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Define Your Goal</h3></div>
        <div className="panel-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="goal-form">
            <label>Target (₹)<input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="50000" /></label>
            <label>Timeline (Months)<input type="number" value={timeline} onChange={e => setTimeline(e.target.value)} placeholder="6" /></label>
            <label>Already Saved (₹)<input type="number" value={current} onChange={e => setCurrent(e.target.value)} placeholder="0" /></label>
          </div>
          <button className="btn-primary" onClick={handleAnalyze} disabled={loading}>
            {loading ? 'Analyzing…' : 'Analyze Goal'}
          </button>
        </div>
      </div>

      {result && (
        <div className="result-box">
          <h4>Goal Analysis</h4>
          {current && +current > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>Progress: {fmt(current)} of {fmt(target)}</span>
                <span>{pct.toFixed(1)}%</span>
              </div>
              <div className="progress-bar" style={{ height: 8 }}>
                <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          )}
          {Object.entries(result).map(([k, v]) => (
            <div className="result-row" key={k}>
              <span>{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
              <strong>{typeof v === 'number' ? (k.includes('rate') || k.includes('pct') ? v.toFixed(1) + '%' : fmt(v)) : String(v)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
