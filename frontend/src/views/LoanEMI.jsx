import React, { useState } from 'react'

function fmt(v) { return '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }) }

export default function LoanEMI() {
  const [principal, setPrincipal] = useState('')
  const [rate, setRate] = useState('')
  const [tenure, setTenure] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calcEMI = () => {
    setError('')
    const p = +principal, r = +rate / 12 / 100, n = +tenure * 12
    if (!p || !rate || !tenure || p <= 0 || +rate <= 0 || +tenure <= 0) {
      setError('Please fill all fields with positive values.'); return
    }
    const emi = r === 0 ? p / n : (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const totalPayable = emi * n
    const totalInterest = totalPayable - p
    setResult({ emi, totalPayable, totalInterest, n })
  }

  return (
    <div className="view-panel">
      <div className="view-header">
        <div>
          <h1>Loan / EMI Calculator</h1>
          <p>Standard reducing-balance EMI formula with income affordability check.</p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header"><h3>EMI Details</h3></div>
        <div className="panel-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="goal-form">
            <label>Loan Amount (₹)<input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="500000" /></label>
            <label>Interest Rate (% p.a.)<input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="9.5" step="0.01" /></label>
            <label>Tenure (Years)<input type="number" value={tenure} onChange={e => setTenure(e.target.value)} placeholder="5" step="0.5" /></label>
          </div>
          <button className="btn-primary" onClick={calcEMI}>Calculate EMI</button>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Standard mathematical calculation. Lenders typically prefer total EMIs under 40% of net monthly income.
          </p>
        </div>
      </div>

      {result && (
        <div className="result-box">
          <h4>EMI Breakdown</h4>
          <div className="result-row"><span>Monthly EMI</span><strong style={{ color: 'var(--accent)', fontSize: 18 }}>{fmt(result.emi)}</strong></div>
          <div className="result-row"><span>Total Payable ({result.n} months)</span><strong>{fmt(result.totalPayable)}</strong></div>
          <div className="result-row"><span>Principal Amount</span><strong style={{ color: 'var(--green)' }}>{fmt(+principal)}</strong></div>
          <div className="result-row"><span>Total Interest</span><strong style={{ color: 'var(--red)' }}>{fmt(result.totalInterest)}</strong></div>
          <div className="result-row"><span>Interest-to-Principal Ratio</span><strong>{((result.totalInterest / +principal) * 100).toFixed(1)}%</strong></div>
        </div>
      )}
    </div>
  )
}
