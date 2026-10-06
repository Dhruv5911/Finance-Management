import React, { useState } from 'react'

function fmt(v) { return '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }) }

export default function Investment() {
  const [mode, setMode] = useState('sip')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [years, setYears] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calcGrowth = () => {
    setError('')
    const a = +amount, r = +rate / 100, y = +years
    if (!a || !rate || !years || a <= 0 || +rate <= 0 || y <= 0) {
      setError('All fields are required with positive values.'); return
    }
    if (mode === 'sip') {
      const monthlyRate = r / 12
      const n = y * 12
      const maturity = a * (Math.pow(1 + monthlyRate, n) - 1) / monthlyRate * (1 + monthlyRate)
      const invested = a * n
      const gains = maturity - invested
      setResult({ maturity, invested, gains, absReturn: (gains / invested * 100) })
    } else {
      const maturity = a * Math.pow(1 + r, y)
      const gains = maturity - a
      setResult({ maturity, invested: a, gains, absReturn: (gains / a * 100) })
    }
  }

  return (
    <div className="view-panel">
      <div className="view-header">
        <div>
          <h1>Investment Growth Calculator</h1>
          <p>Project wealth accumulation for SIP or lump-sum investments.</p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header"><h3>Investment Parameters</h3></div>
        <div className="panel-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div style={{ marginBottom: 14 }}>
            <label>Mode
              <select value={mode} onChange={e => { setMode(e.target.value); setResult(null) }} style={{ maxWidth: 200 }}>
                <option value="sip">Monthly SIP</option>
                <option value="lumpsum">One-time Lump Sum</option>
              </select>
            </label>
          </div>
          <div className="goal-form">
            <label>{mode === 'sip' ? 'Monthly Investment (₹)' : 'Lump Sum Amount (₹)'}
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={mode === 'sip' ? '5000' : '100000'} />
            </label>
            <label>Expected Annual Return (%)<input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="12" step="0.1" /></label>
            <label>Duration (Years)<input type="number" value={years} onChange={e => setYears(e.target.value)} placeholder="10" step="0.5" /></label>
          </div>
          <button className="btn-primary" onClick={calcGrowth}>Project Growth</button>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Compound growth projection based on constant annual return. Actual market returns fluctuate.
          </p>
        </div>
      </div>

      {result && (
        <div className="result-box">
          <h4>Growth Projection</h4>
          <div className="result-row"><span>Maturity Value</span><strong style={{ color: 'var(--accent)', fontSize: 18 }}>{fmt(result.maturity)}</strong></div>
          <div className="result-row"><span>Total Invested</span><strong style={{ color: 'var(--green)' }}>{fmt(result.invested)}</strong></div>
          <div className="result-row"><span>Total Gains</span><strong style={{ color: 'var(--blue)' }}>{fmt(result.gains)}</strong></div>
          <div className="result-row"><span>Absolute Return</span><strong>{result.absReturn.toFixed(2)}%</strong></div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>Invested ({((result.invested / result.maturity) * 100).toFixed(1)}%)</span>
              <span>Gains ({((result.gains / result.maturity) * 100).toFixed(1)}%)</span>
            </div>
            <div style={{ height: 10, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(result.invested / result.maturity) * 100}%`, background: 'var(--green)', borderRadius: '99px 0 0 99px' }} />
              <div style={{ flex: 1, background: 'var(--accent)', borderRadius: '0 99px 99px 0' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
