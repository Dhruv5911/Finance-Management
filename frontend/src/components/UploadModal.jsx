import React, { useState, useRef } from 'react'
import { X, Upload, FileText } from 'lucide-react'
import { useApp } from '../App'
import api from '../api'

export default function UploadModal({ onClose }) {
  const { addToast, refreshData } = useApp()
  const [activeTab, setActiveTab] = useState('csv') // 'csv' | 'pdf'
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const handleCsvFile = async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStatus('Only .csv files are supported for CSV upload.'); setStatusType('error'); return
    }
    const fd = new FormData()
    fd.append('file', file)
    setLoading(true)
    setStatus('Uploading CSV…')
    setStatusType('')
    try {
      const res = await api.post('/api/upload', fd)
      const d = res.data
      setStatus(`✓ Loaded ${d.row_count} transactions`)
      setStatusType('success')
      addToast(`Loaded ${d.row_count} transactions from ${file.name}`, 'success')
      await refreshData()
      setTimeout(onClose, 1200)
    } catch (err) {
      setStatus(err.response?.data?.error || 'CSV upload failed')
      setStatusType('error')
    } finally {
      setLoading(false)
    }
  }

  const handlePdfFile = async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setStatus('Only .pdf files are supported for bank statement upload.'); setStatusType('error'); return
    }
    const fd = new FormData()
    fd.append('statement', file)
    setLoading(true)
    setStatus('Parsing Bank Statement PDF…')
    setStatusType('')
    try {
      const res = await api.post('/api/upload-pdf-statement', fd)
      const d = res.data
      setStatus(`✓ Extracted ${d.count} transactions!`)
      setStatusType('success')
      addToast(`Imported ${d.count} transactions from ${file.name}`, 'success')
      await refreshData()
      setTimeout(onClose, 1200)
    } catch (err) {
      setStatus(err.response?.data?.error || 'Failed to parse bank statement PDF')
      setStatusType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleFile = (file) => {
    if (activeTab === 'csv') handleCsvFile(file)
    else handlePdfFile(file)
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      await api.post('/api/clear-data')
      addToast('Reverted to sample data', 'success')
      await refreshData()
      onClose()
    } catch {
      addToast('Reset failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h3>Import Financial Data</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px 0 20px', borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { setActiveTab('csv'); setStatus(''); }}
            style={{
              padding: '8px 14px',
              borderBottom: activeTab === 'csv' ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0,
              fontWeight: activeTab === 'csv' ? 600 : 400,
              color: activeTab === 'csv' ? 'var(--accent)' : 'inherit',
            }}
          >
            📊 CSV File
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { setActiveTab('pdf'); setStatus(''); }}
            style={{
              padding: '8px 14px',
              borderBottom: activeTab === 'pdf' ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0,
              fontWeight: activeTab === 'pdf' ? 600 : 400,
              color: activeTab === 'pdf' ? 'var(--accent)' : 'inherit',
            }}
          >
            📑 Bank Statement (PDF)
          </button>
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
            <span className="dropzone-title">
              {activeTab === 'csv' ? 'Drag & drop your CSV here' : 'Drag & drop Bank Statement PDF here'}
            </span>
            <span className="dropzone-sub">
              {activeTab === 'csv'
                ? 'or click to browse — columns: date, description, category, type, amount'
                : 'Supports HDFC, ICICI, SBI, Axis, Kotak, and standard bank PDF statements'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept={activeTab === 'csv' ? '.csv' : '.pdf'}
              hidden
              onChange={e => handleFile(e.target.files[0])}
            />
          </label>

          {status && <div className={`upload-status ${statusType}`}>{status}</div>}

          {activeTab === 'csv' ? (
            <>
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
            </>
          ) : (
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              💡 <strong>Smart Extraction:</strong> FinAI parses date, debit/credit amounts, and bank transaction narration, and auto-categorizes them into Food, Shopping, Transport, Salary, etc.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
