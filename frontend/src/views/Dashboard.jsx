import React from 'react'
import {
  TrendingUp, TrendingDown, Percent, Wallet, ArrowUpRight, ArrowDownRight,
  Plus, Upload, ChevronDown, Layers,
} from 'lucide-react'
import { Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement
} from 'chart.js'
import { useApp } from '../App'
import { PALETTE, chartColors, alpha } from '../theme'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement)

function fmt(v) { return '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }
function fmtPct(v) { return (Number(v) || 0).toFixed(1) + '%' }

/** % change between the last two months of a series (null if not enough data). */
function monthDelta(monthly, pick) {
  if (!monthly || monthly.length < 2) return null
  const cur = Number(pick(monthly[monthly.length - 1])) || 0
  const prev = Number(pick(monthly[monthly.length - 2])) || 0
  if (!prev) return null
  return ((cur - prev) / Math.abs(prev)) * 100
}

function Delta({ value, invert = false, hero = false, suffix }) {
  if (value == null) return suffix ? <span>{suffix}</span> : null
  const up = value >= 0
  const good = invert ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <>
      <span className={`delta ${hero ? 'delta-on-hero' : good ? 'up' : 'down'}`}>
        <Icon size={12} />{Math.abs(value).toFixed(0)}%
      </span>
      {suffix && <span>{suffix}</span>}
    </>
  )
}

export default function Dashboard() {
  const { summary, transactions, categories, monthly, user, theme, setUploadOpen, setActiveView } = useApp()
  const C = chartColors(theme)

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const name = user?.name?.split(' ')[0] || 'there'

  const topCats = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const totalExp = Object.values(categories).reduce((s, v) => s + v, 0) || 1

  const incomeDelta = monthDelta(monthly, m => m.income)
  const expenseDelta = monthDelta(monthly, m => m.expenses)
  const balanceDelta = monthDelta(monthly, m => (Number(m.income) || 0) - (Number(m.expenses) || 0))

  const doughnutData = {
    labels: topCats.map(([k]) => k),
    datasets: [{
      data: topCats.map(([, v]) => v),
      backgroundColor: PALETTE.slice(0, topCats.length),
      borderWidth: 0,
      hoverOffset: 6,
    }]
  }
  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { position: 'right', labels: { color: C.legend, font: { size: 12 }, boxWidth: 10, usePointStyle: true, pointStyle: 'circle', padding: 14 } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
    }
  }

  const lineData = {
    labels: monthly.map(m => m.month),
    datasets: [
      {
        label: 'Income', data: monthly.map(m => m.income),
        borderColor: C.income, backgroundColor: alpha(C.income, 0.10),
        fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2.5,
      },
      {
        label: 'Expenses', data: monthly.map(m => m.expenses),
        borderColor: C.expense, backgroundColor: alpha(C.expense, 0.10),
        fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2.5,
      },
    ]
  }
  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: C.legend, font: { size: 12 }, boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` } }
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: C.tick, font: { size: 11 } } },
      y: { grid: { color: C.grid }, border: { display: false }, ticks: { color: C.tick, font: { size: 11 }, callback: v => fmt(v) } }
    }
  }

  const recentTxns = [...transactions].slice(0, 7)

  return (
    <div className="view-panel">
      <div className="dash-hello">
        <h1>{greeting}, {name}</h1>
        <p>Stay on top of your money, monitor spending, and ask FinAI anything.</p>
      </div>

      <div className="dash-top">
        {/* ---- Total balance ---- */}
        <section className="balance-card">
          <div className="balance-head">
            <span className="balance-label">Total Balance</span>
            <span className="currency-pill">INR (₹) <ChevronDown size={14} /></span>
          </div>
          <div className="balance-amount">{fmt(summary.balance)}</div>
          <div className="delta-row">
            <Delta value={balanceDelta} suffix="than last month" />
            {balanceDelta == null && <span>Income − Expenses</span>}
          </div>

          <div className="balance-actions">
            <button className="btn-primary" onClick={() => setActiveView('transactions')}>
              <Plus size={18} /> Add Transaction
            </button>
            <button className="btn-ghost" onClick={() => setUploadOpen(true)}>
              <Upload size={18} /> Upload CSV
            </button>
          </div>

          <div className="wallets">
            <div className="wallets-head">Top spending<span>{Object.keys(categories).length} categories</span></div>
            <div className="wallet-row">
              {topCats.length ? topCats.slice(0, 3).map(([cat, amt], i) => (
                <div className="wallet" key={cat}>
                  <div className="wallet-top">
                    <i className="wallet-dot" style={{ background: PALETTE[i] }} />
                    <span>{cat}</span>
                  </div>
                  <div className="wallet-amount">{fmt(amt)}</div>
                  <div className="wallet-sub">{((amt / totalExp) * 100).toFixed(1)}% of spending</div>
                  <div className="wallet-bar"><i style={{ width: `${(amt / totalExp) * 100}%`, background: PALETTE[i] }} /></div>
                </div>
              )) : (
                <div className="wallet" style={{ gridColumn: '1 / -1', color: 'var(--text-muted)' }}>
                  No spending yet — upload a CSV or add transactions.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ---- KPI tiles ---- */}
        <section className="kpi-grid">
          <div className="kpi hero">
            <div className="kpi-top">
              <span className="kpi-label">Total Income</span>
              <span className="kpi-icon"><Wallet size={18} /></span>
            </div>
            <div className="kpi-value">{fmt(summary.total_income)}</div>
            <div className="kpi-foot">
              <Delta value={incomeDelta} hero suffix="This month" />
              {incomeDelta == null && <span>{summary.transaction_count || 0} total entries</span>}
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-top">
              <span className="kpi-label">Total Expenses</span>
              <span className="kpi-icon"><TrendingDown size={18} /></span>
            </div>
            <div className="kpi-value">{fmt(summary.total_expenses)}</div>
            <div className="kpi-foot">
              <Delta value={expenseDelta} invert suffix="This month" />
              {expenseDelta == null && <span>{Object.keys(categories).length} categories</span>}
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-top">
              <span className="kpi-label">Net Balance</span>
              <span className="kpi-icon"><Layers size={18} /></span>
            </div>
            <div className="kpi-value">{fmt(summary.balance)}</div>
            <div className="kpi-foot">
              <Delta value={balanceDelta} suffix="This month" />
              {balanceDelta == null && <span>Income − Expenses</span>}
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-top">
              <span className="kpi-label">Savings Rate</span>
              <span className="kpi-icon"><Percent size={18} /></span>
            </div>
            <div className="kpi-value">{fmtPct(summary.savings_rate)}</div>
            <div className="kpi-foot">
              <span className={`delta ${(Number(summary.savings_rate) || 0) >= 20 ? 'up' : 'down'}`}>
                {(Number(summary.savings_rate) || 0) >= 20 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {(Number(summary.savings_rate) || 0) >= 20 ? 'On track' : 'Below goal'}
              </span>
              <span>Target ≥ 20%</span>
            </div>
          </div>
        </section>
      </div>

      {/* ---- Charts ---- */}
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <h3>Expense by Category</h3>
            <span className="badge badge-orange">{Object.keys(categories).length} categories</span>
          </div>
          <div className="chart-wrapper">
            {topCats.length ? <Doughnut data={doughnutData} options={doughnutOptions} /> : <EmptyChart />}
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-card-header">
            <h3>Monthly Cashflow Trend</h3>
            <span className="badge badge-orange">{monthly.length} months</span>
          </div>
          <div className="chart-wrapper">
            {monthly.length ? <Line data={lineData} options={lineOptions} /> : <EmptyChart />}
          </div>
        </div>
      </div>

      {/* ---- Categories + recent ---- */}
      <div className="split-grid">
        <div className="panel">
          <div className="panel-header"><h3>Top Spending Categories</h3></div>
          <div className="cat-list">
            {topCats.length ? topCats.map(([cat, amt], i) => (
              <div className="cat-item" key={cat}>
                <div className="cat-item-row">
                  <span className="cat-name">{cat}</span>
                  <span className="cat-amount">{fmt(amt)}<span className="cat-pct">{((amt / totalExp) * 100).toFixed(1)}%</span></span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(amt / totalExp) * 100}%`, background: PALETTE[i] }} />
                </div>
              </div>
            )) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data yet — upload a CSV or add transactions.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Recent Transactions</h3>
            <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setActiveView('transactions')}>
              View all · {transactions.length}
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {recentTxns.length ? recentTxns.map(t => (
                  <tr key={t.id ?? t.date + t.description}>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                    <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{t.category}</span></td>
                    <td>
                      <span style={{ color: t.type === 'income' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No transactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      No data available
    </div>
  )
}
