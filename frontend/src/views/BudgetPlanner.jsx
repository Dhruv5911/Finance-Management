import React, { useState, useMemo, useEffect } from 'react'
import { Lightbulb, Wand2, Target, Wallet, TrendingUp, PiggyBank, ChevronDown, Info } from 'lucide-react'
import { useApp } from '../App'
import '../budget.css'

const fmt = (v) => '₹' + Math.round(Number(v) || 0).toLocaleString('en-IN')
const DEFAULT_CATS = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Groceries', 'Bills', 'Rent', 'Health']
const NEEDS = ['rent', 'bills', 'groceries', 'transport', 'health', 'utilities', 'education', 'emi', 'insurance', 'loan']
const SAVINGS = ['investment', 'investments', 'savings', 'sip']

const monthKey = (d) => String(d || '').slice(0, 7)

export default function BudgetPlanner() {
  const { transactions, user } = useApp()
  const storeKey = `finai-budgets-${user?.id || 'guest'}`

  const [budgets, setBudgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storeKey)) || {} } catch { return {} }
  })
  const [custom, setCustom] = useState('')
  const [open, setOpen] = useState(true)
  const [saved, setSaved] = useState(false)

  // reload when the account changes
  useEffect(() => {
    try { setBudgets(JSON.parse(localStorage.getItem(storeKey)) || {}) } catch { setBudgets({}) }
  }, [storeKey])

  // ---- this month's numbers, worked out right here from your transactions ----
  const m = useMemo(() => {
    const months = transactions.map(t => monthKey(t.date)).filter(Boolean).sort()
    const key = months.length ? months[months.length - 1] : new Date().toISOString().slice(0, 7)
    const [y, mo] = key.split('-').map(Number)
    const daysInMonth = new Date(y, mo, 0).getDate()
    const now = new Date()
    const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === mo
    const day = isCurrent ? now.getDate() : daysInMonth
    const spent = {}
    let income = 0
    transactions.forEach(t => {
      if (monthKey(t.date) !== key) return
      const amt = Number(t.amount) || 0
      if (t.type === 'income') income += amt
      else spent[t.category] = (spent[t.category] || 0) + amt
    })
    const label = new Date(y, mo - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    return { key, label, daysInMonth, day, daysLeft: Math.max(daysInMonth - day, 0), spent, income }
  }, [transactions])

  const cats = useMemo(() => {
    const s = new Set([...DEFAULT_CATS, ...Object.keys(m.spent), ...Object.keys(budgets)])
    return [...s].filter(c => c && c.toLowerCase() !== 'salary')
  }, [m, budgets])

  const setBudget = (cat, v) => { setBudgets(b => ({ ...b, [cat]: v })); setSaved(false) }

  const save = () => {
    const clean = Object.fromEntries(Object.entries(budgets).filter(([, v]) => +v > 0).map(([k, v]) => [k, +v]))
    try { localStorage.setItem(storeKey, JSON.stringify(clean)) } catch {}
    // best effort: also tell the server so the alert monitor can use it (ignored if not available)
    fetch('/api/budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ budgets: clean }) }).catch(() => {})
    setBudgets(clean); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const suggest = () => {
    const next = { ...budgets }
    Object.entries(m.spent).forEach(([c, v]) => { if (c.toLowerCase() !== 'salary') next[c] = Math.ceil((v * 1.1) / 100) * 100 })
    setBudgets(next); setSaved(false)
  }

  const addCustom = () => {
    const c = custom.trim()
    if (!c) return
    setBudgets(b => ({ ...b, [c]: b[c] || '' })); setCustom('')
  }

  // ---- per-category analysis ----
  const rows = cats.map(c => {
    const limit = +budgets[c] || 0
    const spent = m.spent[c] || 0
    const pct = limit ? (spent / limit) * 100 : 0
    const projected = m.day ? (spent / m.day) * m.daysInMonth : spent
    const left = limit - spent
    const perDay = m.daysLeft > 0 ? Math.max(left, 0) / m.daysLeft : 0
    let status = 'none'
    if (limit) status = pct > 100 ? 'over' : pct >= 80 ? 'near' : 'good'
    return { c, limit, spent, pct, projected, left, perDay, status }
  })

  const withLimit = rows.filter(r => r.limit)
  const totalBudget = withLimit.reduce((s, r) => s + r.limit, 0)
  const totalSpentBudgeted = withLimit.reduce((s, r) => s + r.spent, 0)
  const totalSpent = Object.entries(m.spent).reduce((s, [, v]) => s + v, 0)
  const projectedTotal = m.day ? (totalSpent / m.day) * m.daysInMonth : totalSpent

  // ---- 50/30/20 ----
  const needsSpent = Object.entries(m.spent).filter(([c]) => NEEDS.includes(c.toLowerCase())).reduce((s, [, v]) => s + v, 0)
  const savingsSpent = Object.entries(m.spent).filter(([c]) => SAVINGS.includes(c.toLowerCase())).reduce((s, [, v]) => s + v, 0)
  const wantsSpent = Math.max(totalSpent - needsSpent - savingsSpent, 0)
  const saved20 = m.income ? Math.max(m.income - totalSpent, 0) + savingsSpent : 0

  // ---- plain-language insights ----
  const tips = []
  if (!transactions.length) tips.push('Add a few transactions first — the planner then shows real numbers for every category.')
  rows.filter(r => r.status === 'over').forEach(r => tips.push(`${r.c} is over budget by ${fmt(-r.left)}. Try to pause spending there for the rest of the month.`))
  rows.filter(r => r.status === 'near').forEach(r => tips.push(m.daysLeft > 0 ? `${r.c} has used ${r.pct.toFixed(0)}% of its budget. You can spend about ${fmt(r.perDay)} per day for the remaining ${m.daysLeft} days.` : `${r.c} used ${r.pct.toFixed(0)}% of its budget this month.`))
  rows.filter(r => r.limit && r.status !== 'over' && r.projected > r.limit).forEach(r => tips.push(`At your current pace ${r.c} will reach ${fmt(r.projected)} by month end, above your ${fmt(r.limit)} budget.`))
  const top = Object.entries(m.spent).sort((a, b) => b[1] - a[1])[0]
  if (top && totalSpent) tips.push(`${top[0]} is your biggest cost: ${fmt(top[1])} (${((top[1] / totalSpent) * 100).toFixed(0)}% of spending).`)
  const unbudgeted = Object.keys(m.spent).filter(c => !budgets[c] && c.toLowerCase() !== 'salary')
  if (unbudgeted.length) tips.push(`No budget set for: ${unbudgeted.slice(0, 4).join(', ')}. Tap "Suggest from my spending" to fill them quickly.`)
  if (m.income) {
    const rate = ((m.income - totalSpent) / m.income) * 100
    tips.push(rate >= 20 ? `Great — you are saving about ${rate.toFixed(0)}% of income, above the 20% goal.` : `You are saving about ${Math.max(rate, 0).toFixed(0)}% of income. The common goal is 20%.`)
  }

  const STEPS = [
    ['1', 'Set a limit', 'Type how much you want to spend on each category this month.'],
    ['2', 'We compare', 'Your real transactions for the month are added up and checked against each limit.'],
    ['3', 'Get guidance', 'Green is safe, orange is close to the limit, red is over. You also see a daily allowance and a month-end forecast.'],
  ]

  return (
    <div className="view-panel bp">
      <div className="view-header">
        <div>
          <h1>Budget Planner</h1>
          <p>Set monthly limits and see how your spending compares — {m.label}{m.daysLeft > 0 ? `, ${m.daysLeft} days left` : ' (month complete)'}.</p>
        </div>
        <div className="view-header-actions">
          <button className="btn-ghost" onClick={suggest}><Wand2 size={15} /> Suggest from my spending</button>
          <button className="btn-primary" onClick={save}>{saved ? 'Saved ✓' : 'Save budgets'}</button>
        </div>
      </div>

      {/* How it works */}
      <div className="panel bp-how">
        <button className="bp-how-head" onClick={() => setOpen(o => !o)}>
          <span><Info size={16} /> How the Budget Planner works</span>
          <ChevronDown size={18} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.25s' }} />
        </button>
        {open && (
          <div className="bp-steps">
            {STEPS.map(([n, t, d]) => (
              <div key={n} className="bp-step"><b>{n}</b><div><strong>{t}</strong><p>{d}</p></div></div>
            ))}
          </div>
        )}
      </div>

      {/* Summary tiles */}
      <div className="bp-tiles">
        <div className="bp-tile"><Target size={18} /><small>Total budget</small><b>{fmt(totalBudget)}</b></div>
        <div className="bp-tile"><Wallet size={18} /><small>Spent so far</small><b>{fmt(totalSpent)}</b></div>
        <div className="bp-tile"><PiggyBank size={18} /><small>Left in budgets</small><b className={totalBudget - totalSpentBudgeted < 0 ? 'neg' : ''}>{fmt(totalBudget - totalSpentBudgeted)}</b></div>
        <div className="bp-tile"><TrendingUp size={18} /><small>Month-end forecast</small><b>{fmt(projectedTotal)}</b></div>
      </div>

      <div className="bp-cols">
        {/* Categories */}
        <div className="panel">
          <div className="panel-header"><h3>Your category budgets</h3></div>
          <div className="panel-body bp-list">
            {rows.map(r => (
              <div className={`bp-row ${r.status}`} key={r.c}>
                <div className="bp-row-top">
                  <strong>{r.c}</strong>
                  <div className="bp-input"><span>₹</span>
                    <input type="number" min="0" step="100" placeholder="Set limit" value={budgets[r.c] ?? ''} onChange={e => setBudget(r.c, e.target.value)} />
                  </div>
                </div>
                <div className="bp-bar"><i style={{ width: `${r.limit ? Math.min(r.pct, 100) : 0}%` }} /></div>
                <div className="bp-row-meta">
                  <span>Spent <b>{fmt(r.spent)}</b></span>
                  {r.limit ? (
                    <>
                      <span>{r.left >= 0 ? <>Left <b>{fmt(r.left)}</b></> : <>Over by <b className="neg">{fmt(-r.left)}</b></>}</span>
                      <span className="bp-badge">{r.status === 'over' ? 'Over budget' : r.status === 'near' ? 'Close to limit' : 'On track'} · {r.pct.toFixed(0)}%</span>
                    </>
                  ) : <span className="muted">No limit set</span>}
                </div>
                {r.limit > 0 && m.daysLeft > 0 && r.left > 0 && (
                  <div className="bp-hint">You can spend about <b>{fmt(r.perDay)}</b> per day for the next {m.daysLeft} days.</div>
                )}
              </div>
            ))}
            <div className="bp-add">
              <input placeholder="Add your own category (e.g. Gym)" value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom()} />
              <button className="btn-ghost" onClick={addCustom}>Add</button>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bp-side">
          <div className="panel">
            <div className="panel-header"><h3><Lightbulb size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Insights for you</h3></div>
            <div className="panel-body">
              <ul className="bp-tips">{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h3>50 / 30 / 20 rule</h3></div>
            <div className="panel-body">
              <p className="bp-note">A simple guide: 50% of income for needs, 30% for wants, 20% for savings.</p>
              {[['Needs', 0.5, needsSpent], ['Wants', 0.3, wantsSpent], ['Savings', 0.2, saved20]].map(([n, p, a]) => {
                const target = m.income * p
                const pc = target ? Math.min((a / target) * 100, 100) : 0
                return (
                  <div className="bp-rule" key={n}>
                    <div><strong>{n}</strong><span>{fmt(a)} / {fmt(target)}</span></div>
                    <div className="bp-bar"><i style={{ width: `${pc}%` }} /></div>
                  </div>
                )
              })}
              {!m.income && <p className="bp-note">Add an income transaction to see your targets.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}