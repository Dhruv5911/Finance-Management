import React, { useState, useEffect, useMemo } from 'react'
import { ArrowUpDown, RefreshCw, Copy, Check, TrendingUp } from 'lucide-react'
import '../currency.css'

const POPULAR = ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'SGD', 'CAD', 'AUD', 'CHF', 'INR']
const QUICK = [100, 500, 1000, 5000, 10000]

const flag = (code) => {
  const c = String(code || '').slice(0, 2).toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return '🌐'
  return String.fromCodePoint(...[...c].map(ch => 127397 + ch.charCodeAt(0)))
}
let names
try { names = new Intl.DisplayNames(['en'], { type: 'currency' }) } catch { names = null }
const nameOf = (code) => { try { return names?.of(code) || code } catch { return code } }
const num = (v, max = 4) => Number(v).toLocaleString('en-IN', { maximumFractionDigits: max })

export default function CurrencyConverter() {
  const [from, setFrom] = useState('INR')
  const [to, setTo] = useState('USD')
  const [amount, setAmount] = useState('10000')
  const [rates, setRates] = useState(null)
  const [updated, setUpdated] = useState('')
  const [currencies, setCurrencies] = useState(POPULAR)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [spin, setSpin] = useState(0)

  const load = async (base) => {
    setError(''); setLoading(true)
    try {
      const r = await fetch(`https://open.er-api.com/v6/latest/${base}`)
      const d = await r.json()
      if (!d.rates) throw new Error('no rates')
      setRates(d.rates)
      setCurrencies(Object.keys(d.rates).sort())
      setUpdated(d.time_last_update_utc || '')
    } catch {
      setError('Could not fetch live rates. Check your internet connection and try again.')
    } finally { setLoading(false) }
  }

  // rates reload whenever the "from" currency changes; the result updates as you type
  useEffect(() => { load(from) }, [from])

  const rate = rates?.[to]
  const result = rate !== undefined && amount !== '' ? (+amount || 0) * rate : null

  const swap = () => { setFrom(to); setTo(from); setSpin(s => s + 180) }
  const copy = async () => {
    if (result === null) return
    try { await navigator.clipboard.writeText(String(+result.toFixed(4))); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  const tiles = useMemo(() => POPULAR.filter(c => c !== from && rates?.[c] !== undefined), [rates, from])
  const shortUpdated = updated ? updated.replace(/ \+0000$/, ' UTC').split(' ').slice(0, 5).join(' ') : ''

  const Select = ({ value, onChange }) => (
    <div className="cc-select">
      <span className="cc-flag">{flag(value)}</span>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label="Currency" title={nameOf(value)}>
        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )

  return (
    <div className="view-panel cc">
      <div className="view-header">
        <div>
          <h1>Currency Converter</h1>
          <p>Live exchange rates, converted as you type.</p>
        </div>
        <div className="view-header-actions">
          <button className="btn-ghost" onClick={() => load(from)} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'cc-spin' : ''} /> Refresh rates
          </button>
        </div>
      </div>

      <div className="cc-grid">
        <div className="cc-card">
          {error && <div className="cc-error">{error}</div>}

          <div className="cc-box">
            <small>You send</small>
            <div className="cc-line">
              <input className="cc-amount" type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" aria-label="Amount" />
              <Select value={from} onChange={setFrom} />
            </div>
            <div className="cc-quick">
              {QUICK.map(q => <button key={q} className={+amount === q ? 'on' : ''} onClick={() => setAmount(String(q))}>{num(q)}</button>)}
            </div>
          </div>

          <div className="cc-swap-row">
            <button className="cc-swap" onClick={swap} aria-label="Swap currencies" style={{ transform: `rotate(${spin}deg)` }}><ArrowUpDown size={18} /></button>
            <div className="cc-rate-pill">
              {rate !== undefined ? <>1 {from} = <b>{num(rate, 4)}</b> {to}</> : 'Fetching rate…'}
            </div>
          </div>

          <div className="cc-box out">
            <small>They get</small>
            <div className="cc-line">
              <div className={`cc-amount cc-result ${loading ? 'dim' : ''}`}>{result === null ? '—' : num(result, 2)}</div>
              <Select value={to} onChange={setTo} />
            </div>
            <div className="cc-foot">
              <span>{result === null ? '' : `${num(+amount || 0, 2)} ${from} = ${num(result, 4)} ${to}`}</span>
              <button className="cc-copy" onClick={copy} disabled={result === null}>
                {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>
          </div>

          <p className="cc-note">{shortUpdated ? `Rates last updated ${shortUpdated}. ` : ''}Source: open.er-api.com. Rates are indicative; banks add their own fees.</p>
        </div>

        <div className="cc-side">
          <div className="cc-card">
            <h3><TrendingUp size={16} /> 1 {from} is worth</h3>
            <div className="cc-tiles">
              {tiles.map(c => (
                <button key={c} className={`cc-tile ${c === to ? 'on' : ''}`} onClick={() => setTo(c)}>
                  <span className="cc-flag">{flag(c)}</span>
                  <div><b>{c}</b><small>{nameOf(c)}</small></div>
                  <em>{num(rates[c], rates[c] < 1 ? 4 : 2)}</em>
                </button>
              ))}
              {!tiles.length && <p className="cc-note">{loading ? 'Loading rates…' : 'No rates yet.'}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}