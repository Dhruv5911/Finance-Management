import React, { useState, useEffect } from 'react'
import { ArrowLeftRight, Loader } from 'lucide-react'

const POPULAR = ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'SGD', 'CAD', 'AUD', 'CHF', 'INR']

export default function CurrencyConverter() {
  const [from, setFrom] = useState('INR')
  const [to, setTo] = useState('USD')
  const [amount, setAmount] = useState('1000')
  const [result, setResult] = useState(null)
  const [rate, setRate] = useState(null)
  const [currencies, setCurrencies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(d => { if (d.rates) setCurrencies(Object.keys(d.rates).sort()) })
      .catch(() => setCurrencies(POPULAR))
  }, [])

  const handleConvert = async () => {
    setError(''); setLoading(true)
    try {
      const r = await fetch(`https://open.er-api.com/v6/latest/${from}`)
      const d = await r.json()
      if (!d.rates?.[to]) { setError('Could not fetch rate for this pair.'); return }
      const fetchedRate = d.rates[to]
      setRate(fetchedRate)
      setResult(+amount * fetchedRate)
    } catch { setError('Could not fetch exchange rate. Check your internet connection.') }
    finally { setLoading(false) }
  }

  const swap = () => { setFrom(to); setTo(from); setResult(null); setRate(null) }

  return (
    <div className="view-panel">
      <div className="view-header">
        <div>
          <h1>Live Currency Converter</h1>
          <p>Convert currencies using live international exchange rates from open.er-api.com.</p>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 600 }}>
        <div className="panel-header"><h3>Convert Currency</h3></div>
        <div className="panel-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div style={{ marginBottom: 14 }}>
            <label>Amount
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="any" />
            </label>
          </div>
          <div className="converter-row">
            <label>From
              <select value={from} onChange={e => setFrom(e.target.value)}>
                {(currencies.length ? currencies : POPULAR).map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <button className="converter-swap" onClick={swap} title="Swap currencies">
              <ArrowLeftRight size={16} />
            </button>
            <label>To
              <select value={to} onChange={e => setTo(e.target.value)}>
                {(currencies.length ? currencies : POPULAR).map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <button className="btn-primary" onClick={handleConvert} disabled={loading} style={{ width: '100%', padding: 11 }}>
            {loading ? <><Loader size={14} style={{ display: 'inline', animation: 'spin 0.7s linear infinite', verticalAlign: 'middle', marginRight: 6 }} />Converting…</> : 'Convert Currency'}
          </button>

          {result !== null && (
            <div className="converter-result">
              <div className="converter-result-val">
                {(+amount).toLocaleString()} {from} = {result.toLocaleString(undefined, { maximumFractionDigits: 4 })} {to}
              </div>
              <div className="converter-result-rate">1 {from} = {rate?.toFixed(4)} {to} · Rates via Open Exchange Rates</div>
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            Exchange rates updated daily via Open Exchange Rates API (open.er-api.com).
          </p>
        </div>
      </div>
    </div>
  )
}
