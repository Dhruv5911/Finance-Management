import React, { useState } from 'react'
import { useApp } from '../App'

export default function AuthScreen() {
  const { setScreen, setUser, addToast } = useApp()
  const [mode, setMode] = useState('login') // login | signup
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (mode === 'signup' && !name.trim()) { setError('Name is required.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    // Simulate local auth (no real backend auth endpoint)
    await new Promise(r => setTimeout(r, 400))
    setUser({ name: name || email.split('@')[0], email })
    addToast(`Welcome, ${name || email.split('@')[0]}!`, 'success')
    setScreen('app')
    setLoading(false)
  }

  const handleGuest = () => {
    setUser(null)
    setScreen('app')
  }

  return (
    <div className="auth-screen">
      <div className="auth-illustration" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>₹</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>FinAI Personal Finance</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Grounded AI & deterministic intelligence</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
          {['Track income & expenses', 'AI-powered insights', 'Budget & goal planners', 'Live currency converter'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
              <span style={{ color: 'var(--green)' }}>✓</span> {f}
            </div>
          ))}
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <span className="auth-logo-name">Fin<em>AI</em></span>
          </div>

          <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
          <p>{mode === 'login' ? 'Sign in to your account' : 'Start managing your personal finances'}</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="auth-form-group">
                <label>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              </div>
            )}
            <div className="auth-form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="auth-form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '11px', marginTop: 4 }} disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>
          <button className="btn-ghost" style={{ width: '100%', padding: '11px' }} onClick={handleGuest}>
            Continue as Guest (No Login)
          </button>

          <p className="auth-switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <a href="#" onClick={e => { e.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </a>
          </p>
          <p style={{ textAlign: 'center', marginTop: 10 }}>
            <button style={{ background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }} onClick={() => setScreen('landing')}>
              ← Back to home
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
