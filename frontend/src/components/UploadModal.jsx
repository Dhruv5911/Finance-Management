import React, { useState, useRef } from 'react'
import { X, Upload, FileText } from 'lucide-react'
import { useApp } from '../App'

export default function UploadModal({ onClose }) {
  const { addToast, refreshData } = useApp()
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const handleFile = async (file) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setStatus('Only .csv files are supported.'); setStatusType('error'); return
    }
    const fd = new FormData()
    fd.append('file', file)
    setLoading(true)
    setStatus('Uploading…')
    setStatusType('')
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) {
        setStatus(d.error || 'Upload failed'); setStatusType('error')
      } else {
        setStatus(`✓ Loaded ${d.row_count} transactions`); setStatusType('success')
        addToast(`Loaded ${d.row_count} transactions from ${file.name}`, 'success')
        await refreshData()
        setTimeout(onClose, 1200)
      }
    } catch {
      setStatus('Network error. Is the server running?'); setStatusType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/clear-data', { method: 'POST' })
      const d = await r.json()
      addToast('Reverted to sample data', 'success')
      await refreshData()
      onClose()
    } catch { addToast('Reset failed', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Upload Transaction CSV</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <label
            className={`dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={28} style={{ color: 'var(--accent)', margin: '0 auto', display: 'block' }} />
            <span className="dropzone-title">Drag & drop your CSV here</span>
            <span className="dropzone-sub">or click to browse — columns: date, description, category, type, amount</span>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => handleFile(e.target.files[0])} />
          </label>
          {status && <div className={`upload-status ${statusType}`}>{status}</div>}
          <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={handleReset} disabled={loading}>
              Revert to Sample Data
            </button>
            <a href="/api/download-sample" download="sample_transactions.csv" className="btn-ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Download Sample CSV
            </a>
          </div>
          <div className="code-preview" style={{ marginTop: 14 }}>
            <code>date,description,category,type,amount</code>
            <code>2026-01-01,Monthly Salary,Salary,income,50000</code>
            <code>2026-01-03,House Rent,Rent,expense,12000</code>
          </div>
        </div>
      </div>
    </div>
  )
}
