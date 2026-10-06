import React, { useState } from 'react'
import { Pencil, Trash2, Plus, Upload } from 'lucide-react'
import { useApp } from '../App'

function fmt(v) { return '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }) }

const today = () => new Date().toISOString().split('T')[0]

export default function Transactions() {
  const { transactions, refreshData, addToast, setUploadOpen } = useApp()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [editId, setEditId] = useState(null)

  // Form state
  const [date, setDate] = useState(today())
  const [desc, setDesc] = useState('')
  const [cat, setCat] = useState('')
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const cats = [...new Set(transactions.map(t => t.category).filter(Boolean))].sort()

  const filtered = transactions
    .filter(t => {
      const q = search.toLowerCase()
      if (q && !t.description?.toLowerCase().includes(q) && !t.category?.toLowerCase().includes(q)) return false
      if (catFilter && t.category !== catFilter) return false
      if (typeFilter && t.type !== typeFilter) return false
      return true
    })
    .sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol]
      if (sortCol === 'amount') { va = +va; vb = +vb }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const sortIcon = (col) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const resetForm = () => { setDate(today()); setDesc(''); setCat(''); setType('expense'); setAmount(''); setFormError(''); setEditId(null) }

  const handleEdit = (t) => {
    setEditId(t.id)
    setDate(t.date)
    setDesc(t.description)
    setCat(t.category)
    setType(t.type)
    setAmount(String(t.amount))
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return
    try {
      const r = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      if (r.ok) { addToast('Transaction deleted', 'success'); await refreshData() }
      else { addToast('Delete failed', 'error') }
    } catch { addToast('Network error', 'error') }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!date || !desc.trim() || !cat.trim() || !amount || isNaN(+amount) || +amount <= 0) {
      setFormError('All fields are required. Amount must be positive.'); return
    }
    setFormLoading(true)
    try {
      let r, d
      if (editId !== null) {
        await fetch(`/api/transactions/${editId}`, { method: 'DELETE' })
      }
      r = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, description: desc.trim(), category: cat.trim(), type, amount: +amount }),
      })
      d = await r.json()
      if (!r.ok) { setFormError(d.error || 'Could not save transaction.'); return }
      addToast(editId !== null ? 'Transaction updated' : 'Transaction added', 'success')
      resetForm()
      await refreshData()
    } catch { setFormError('Network error.') }
    finally { setFormLoading(false) }
  }

  return (
    <div className="view-panel">
      <div className="view-header">
        <div>
          <h1>Transactions</h1>
          <p>Search, filter, add, edit, and delete your financial records.</p>
        </div>
        <div className="view-header-actions">
          <button className="btn-ghost" onClick={() => setUploadOpen(true)}><Upload size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Upload CSV</button>
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h3>{editId !== null ? '✏️ Edit Transaction' : '+ Add a Transaction'}</h3>
          {editId !== null && <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={resetForm}>Cancel Edit</button>}
        </div>
        <div className="panel-body">
          {formError && <div className="auth-error" style={{ marginBottom: 12 }}>{formError}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label>Description<input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Grocery store" /></label>
            <label>Category<input type="text" value={cat} onChange={e => setCat(e.target.value)} placeholder="e.g. Groceries" /></label>
            <label>Type
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label>Amount (₹)<input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min="0.01" step="0.01" /></label>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '9px' }} disabled={formLoading}>
                {formLoading ? 'Saving…' : editId !== null ? 'Update' : 'Add Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="panel">
        <div className="panel-header">
          <h3>All Transactions</h3>
          <span className="badge badge-orange">{filtered.length} rows</span>
        </div>
        <div className="table-controls">
          <input type="text" placeholder="Search description or category…" value={search} onChange={e => setSearch(e.target.value)} />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All categories</option>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('date')}>Date{sortIcon('date')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('description')}>Description{sortIcon('description')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('category')}>Category{sortIcon('category')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('type')}>Type{sortIcon('type')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('amount')}>Amount{sortIcon('amount')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map(t => (
                <tr key={t.id ?? t.date + t.description}>
                  <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.date}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                  <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{t.category}</span></td>
                  <td><span className={`txn-type-pill ${t.type}`}>{t.type}</span></td>
                  <td style={{ fontWeight: 600, color: t.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                    {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" style={{ padding: '5px' }} onClick={() => handleEdit(t)} title="Edit"><Pencil size={13} /></button>
                      <button className="btn-icon" style={{ padding: '5px', borderColor: 'var(--red-dim)', color: 'var(--red)' }} onClick={() => handleDelete(t.id)} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No transactions match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
