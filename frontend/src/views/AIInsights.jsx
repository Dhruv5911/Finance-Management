import React, { useState } from 'react'
import { Lightbulb, Heart } from 'lucide-react'

export default function AIInsights() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')

  const load = async (type) => {
    setError(''); setLoading(type); setResult('')
    const query = type === 'health'
      ? 'Give me a comprehensive financial health analysis with score, strengths, and improvement areas based on my current transactions.'
      : 'Analyze my spending patterns in detail. What categories am I overspending in? Where can I save more?'
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Insight generation failed.'); return }
      setResult(d.answer || 'No insight generated.')
    } catch { setError('Network error.') }
    finally { setLoading('') }
  }

  return (
    <div className="view-panel">
      <div className="view-header">
        <div>
          <h1>Financial Health & Insights</h1>
          <p>Automated deep-dive analysis powered by FinAI's financial insight engine.</p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header"><h3>Choose an Insight</h3></div>
        <div className="panel-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="insights-actions">
            <button className="btn-primary" onClick={() => load('health')} disabled={!!loading}>
              <Heart size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              {loading === 'health' ? 'Evaluating…' : 'Evaluate Financial Health Score'}
            </button>
            <button className="btn-ghost" onClick={() => load('spending')} disabled={!!loading}>
              <Lightbulb size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              {loading === 'spending' ? 'Analyzing…' : 'Analyze Spending Patterns'}
            </button>
          </div>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
              <div className="spinner" />
              FinAI is generating your insight…
            </div>
          )}
          {result && !loading && (
            <div className="insights-result" style={{ whiteSpace: 'pre-wrap' }}>
              {result}
            </div>
          )}
          {!result && !loading && !error && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Choose an insight above to generate a report from your current transaction data.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
