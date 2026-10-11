import React, { useState, useRef } from 'react'
import { X, Camera, Check, AlertCircle, Sparkles, RefreshCw } from 'lucide-react'
import { useApp } from '../App'
import api from '../api'

export default function ReceiptScanModal({ onClose }) {
  const { addToast, refreshData } = useApp()
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scannedData, setScannedData] = useState(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef()

  const handleSelectFile = (selected) => {
    if (!selected) return
    if (!selected.type.startsWith('image/')) {
      setError('Please select an image file (.png, .jpg, .jpeg, .webp)')
      return
    }
    setError('')
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setScannedData(null)
  }

  const handleScan = async () => {
    if (!file) return
    setScanning(true)
    setError('')
    const fd = new FormData()
    fd.append('receipt', file)

    try {
      const res = await api.post('/api/scan-receipt', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setScannedData({
        merchant: res.data.merchant || '',
        date: res.data.date || new Date().toISOString().split('T')[0],
        amount: res.data.amount || '',
        category: res.data.category || 'Food & Dining',
        description: res.data.description || '',
      })
      addToast('Receipt analyzed successfully!', 'success')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to analyze receipt image.')
    } finally {
      setScanning(false)
    }
  }

  const handleSaveTransaction = async (e) => {
    e.preventDefault()
    if (!scannedData) return
    setSaving(true)
    setError('')

    try {
      await api.post('/api/transactions', {
        date: scannedData.date,
        description: scannedData.description || scannedData.merchant || 'Receipt Expense',
        category: scannedData.category || 'Food & Dining',
        type: 'expense',
        amount: parseFloat(scannedData.amount),
      })
      addToast(`Added ₹${scannedData.amount} for ${scannedData.merchant || 'receipt'}!`, 'success')
      await refreshData()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save transaction.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#7b5cff" />
            <h3>AI Receipt & Bill Scanner</h3>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              background: 'var(--red-dim, #ffebee)',
              color: 'var(--red, #d32f2f)',
              padding: '10px 14px',
              borderRadius: 12,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!scannedData ? (
            <>
              <div
                className="drop-zone"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed rgba(123, 92, 255, 0.3)',
                  borderRadius: 16,
                  padding: '30px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-tile)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleSelectFile(e.target.files[0])}
                />
                <Camera size={36} color="#7b5cff" />
                <strong>{file ? file.name : 'Drop receipt image here or click to browse'}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  PNG, JPG, or WEBP up to 5MB
                </span>
              </div>

              {previewUrl && (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    style={{ maxHeight: 180, borderRadius: 12, border: '1px solid var(--border)' }}
                  />
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary"
                disabled={!file || scanning}
                onClick={handleScan}
                style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
              >
                {scanning ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Analyzing with Gemini Vision…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Scan & Extract Details</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <form onSubmit={handleSaveTransaction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: 'rgba(123, 92, 255, 0.08)',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 13,
                color: '#7b5cff',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <Check size={16} />
                <span>Extracted details. Review and click Save!</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  <span>Merchant / Store</span>
                  <input
                    type="text"
                    value={scannedData.merchant}
                    onChange={e => setScannedData({ ...scannedData, merchant: e.target.value })}
                    required
                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-tile)' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  <span>Date</span>
                  <input
                    type="date"
                    value={scannedData.date}
                    onChange={e => setScannedData({ ...scannedData, date: e.target.value })}
                    required
                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-tile)' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  <span>Amount (₹)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={scannedData.amount}
                    onChange={e => setScannedData({ ...scannedData, amount: e.target.value })}
                    required
                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-tile)', fontWeight: 'bold' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  <span>Category</span>
                  <select
                    value={scannedData.category}
                    onChange={e => setScannedData({ ...scannedData, category: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-tile)' }}
                  >
                    <option value="Food & Dining">Food & Dining</option>
                    <option value="Groceries">Groceries</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Health">Health</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span>Description / Items</span>
                <input
                  type="text"
                  value={scannedData.description}
                  onChange={e => setScannedData({ ...scannedData, description: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-tile)' }}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScannedData(null)}
                  style={{ flex: 1 }}
                >
                  Scan Another
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ flex: 2 }}
                >
                  {saving ? 'Saving…' : 'Add to Transactions'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
