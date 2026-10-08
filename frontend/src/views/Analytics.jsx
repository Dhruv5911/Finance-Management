import React from 'react'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Filler, Tooltip, Legend
} from 'chart.js'
import { useApp } from '../App'
import { PALETTE, chartColors, alpha } from '../theme'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Tooltip, Legend)

function fmt(v) { return '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }


export default function Analytics() {
  const { categories, monthly, theme } = useApp()
  const C = chartColors(theme)
  const gridOpts = { color: C.grid }
  const tickOpts = { color: C.tick, font: { size: 11 } }

  const catEntries = Object.entries(categories).sort((a, b) => b[1] - a[1])
  const totalExp = catEntries.reduce((s, [, v]) => s + v, 0) || 1

  // Bar chart: monthly income vs expenses
  const barData = {
    labels: monthly.map(m => m.month),
    datasets: [
      { label: 'Income', data: monthly.map(m => m.income), backgroundColor: alpha(C.income, 0.85), borderRadius: 8, borderSkipped: false },
      { label: 'Expenses', data: monthly.map(m => m.expenses), backgroundColor: alpha(C.expense, 0.9), borderRadius: 8, borderSkipped: false },
    ]
  }
  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: C.legend, font: { size: 12 }, boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } }, tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` } } },
    scales: { x: { grid: gridOpts, ticks: tickOpts }, y: { grid: gridOpts, ticks: { ...tickOpts, callback: v => fmt(v) } } }
  }

  // Savings rate line
  const savingsData = {
    labels: monthly.map(m => m.month),
    datasets: [{
      label: 'Savings Rate %',
      data: monthly.map(m => m.income > 0 ? ((m.income - m.expenses) / m.income * 100).toFixed(1) : 0),
      borderColor: C.blue, backgroundColor: alpha(C.blue, 0.10),
      fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2,
    }]
  }
  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: C.legend, font: { size: 12 }, boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw}%` } } },
    scales: {
      x: { grid: gridOpts, ticks: tickOpts },
      y: { grid: gridOpts, ticks: { ...tickOpts, callback: v => v + '%' }, min: 0 }
    }
  }

  const topCat = catEntries[0]?.[0] || '—'
  const avgExp = monthly.length ? fmt(monthly.reduce((s, m) => s + m.expenses, 0) / monthly.length) : '—'
  const bestMonth = monthly.length ? monthly.reduce((best, m) => ((m.income - m.expenses) > (best.income - best.expenses) ? m : best), monthly[0])?.month : '—'

  return (
    <div className="view-panel">
      <div className="view-header">
        <div>
          <h1>Analytics & Deep Breakdown</h1>
          <p>Historical trends, savings efficiency, and category expenditure shares.</p>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-header"><h3>Monthly Income vs Expenses</h3></div>
          <div className="chart-wrapper">
            {monthly.length ? <Bar data={barData} options={barOptions} /> : <EmptyChart />}
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-card-header"><h3>Savings Rate History (%)</h3></div>
          <div className="chart-wrapper">
            {monthly.length ? <Line data={savingsData} options={lineOptions} /> : <EmptyChart />}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-header"><h3>Category Spending Breakdown</h3></div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {catEntries.length ? catEntries.map(([cat, amt], i) => (
            <div key={cat}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                <span style={{ fontWeight: 600 }}>{fmt(amt)} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>({((amt / totalExp) * 100).toFixed(1)}%)</span></span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(amt / totalExp) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
              </div>
            </div>
          )) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data yet.</p>}
        </div>
      </div>

      <div className="analytics-summary">
        <div className="stat-box">
          <span>Top Spending Category</span>
          <strong>{topCat}</strong>
        </div>
        <div className="stat-box">
          <span>Average Monthly Expense</span>
          <strong>{avgExp}</strong>
        </div>
        <div className="stat-box">
          <span>Best Savings Month</span>
          <strong>{bestMonth}</strong>
        </div>
      </div>
    </div>
  )
}

function EmptyChart() {
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No data available</div>
}
