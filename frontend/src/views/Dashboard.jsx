import React, { useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Percent, RefreshCw } from 'lucide-react'
import { Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement
} from 'chart.js'
import { useApp } from '../App'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler, BarElement)

function fmt(v) { return '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }
function fmtPct(v) { return (Number(v) || 0).toFixed(1) + '%' }

const PALETTE = ['#e8621a','#3ecf8e','#60a5fa','#ef4444','#c084fc','#fb7185','#2dd4bf','#fbbf6e','#a3e635','#fb923c']

export default function Dashboard() {
  const { summary, transactions, categories, monthly, refreshData } = useApp()

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const topCats = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const totalExp = Object.values(categories).reduce((s, v) => s + v, 0) || 1

  // Doughnut chart
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
    cutout: '68%',
    plugins: {
      legend: { position: 'right', labels: { color: '#9898a8', font: { size: 11 }, boxWidth: 10, padding: 12 } },
      tooltip: {
        callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` }
      }
    }
  }

  // Line chart
  const lineData = {
    labels: monthly.map(m => m.month),
    datasets: [
      {
        label: 'Income', data: monthly.map(m => m.income),
        borderColor: '#3ecf8e', backgroundColor: 'rgba(62,207,142,0.1)',
        fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2,
      },
      {
        label: 'Expenses', data: monthly.map(m => m.expenses),
        borderColor: '#e8621a', backgroundColor: 'rgba(232,98,26,0.1)',
        fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2,
      },
    ]
  }
  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#9898a8', font: { size: 11 }, boxWidth: 10 } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` } }
    },
    scales: {
      x: { grid: { color: '#1f1f28' }, ticks: { color: '#5c5c70', font: { size: 10 } } },
      y: { grid: { color: '#1f1f28' }, ticks: { color: '#5c5c70', font: { size: 10 }, callback: v => fmt(v) } }
    }
  }

  const recentTxns = [...transactions].slice(0, 7)

  return (
    <div className="view-panel">
      {/* Greeting */}
      <div className="greeting-banner">
        <div className="greeting-text">
          <h2>{greeting}! 👋 Need help?</h2>
          <p>Just ask me anything — your AI finance assistant is ready.</p>
        </div>
        <div className="greeting-date">
          <strong>{now.getDate()}</strong>
          <span>{now.toLocaleDateString('en-IN', { weekday: 'short', month: 'long' })}</span>
          <button className="btn-icon" onClick={refreshData} title="Refresh data" style={{ marginTop: 6 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-grid">
        <div className="metric-card income">
          <div className="metric-icon"><TrendingUp size={18} /></div>
          <span className="metric-label">Total Income</span>
          <span className="metric-value">{fmt(summary.total_income)}</span>
          <span className="metric-sub">{summary.transaction_count || 0} total entries</span>
        </div>
        <div className="metric-card expense">
          <div className="metric-icon"><TrendingDown size={18} /></div>
          <span className="metric-label">Total Expenses</span>
          <span className="metric-value">{fmt(summary.total_expenses)}</span>
          <span className="metric-sub">{Object.keys(categories).length} categories</span>
        </div>
        <div className="metric-card balance">
          <div className="metric-icon"><DollarSign size={18} /></div>
          <span className="metric-label">Net Balance</span>
          <span className="metric-value">{fmt(summary.balance)}</span>
          <span className="metric-sub">Income − Expenses</span>
        </div>
        <div className="metric-card rate">
          <div className="metric-icon"><Percent size={18} /></div>
          <span className="metric-label">Savings Rate</span>
          <span className="metric-value">{fmtPct(summary.savings_rate)}</span>
          <span className="metric-sub">Benchmark: ≥ 20%</span>
        </div>
      </div>

      {/* Charts */}
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

      {/* Split: Top Categories + Recent Txns */}
      <div className="split-grid">
        <div className="panel">
          <div className="panel-header">
            <h3>Top Spending Categories</h3>
          </div>
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
            <span className="badge badge-orange">{transactions.length} total</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTxns.length ? recentTxns.map(t => (
                  <tr key={t.id ?? t.date + t.description}>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                    <td>
                      <span className="badge badge-blue" style={{ fontSize: 10 }}>{t.category}</span>
                    </td>
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
