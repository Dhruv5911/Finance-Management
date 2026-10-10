import React, { useState, useEffect, useRef } from 'react'
import { Mail, Lock, Eye, EyeOff, User, ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react'
import { useApp } from '../App'
import '../auth.css'

export default function AuthScreen() {
  const { setScreen, setUser, addToast } = useApp()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [step, setStep] = useState('form') // 'form' | 'otp'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // OTP state
  const [targetEmail, setTargetEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(60)
  const [resending, setResending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const otpInputsRef = useRef([])

  const signup = mode === 'signup'

  // Read error parameter from URL (e.g. from Google OAuth cancel/failure)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const err = params.get('error')
      if (err) {
        setError(decodeURIComponent(err))
        const url = new URL(window.location.href)
        url.searchParams.delete('error')
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
      }
    } catch {}
  }, [])

  // Auto-focus first OTP input when transitioning to OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus()
      }, 100)
    }
  }, [step])

  // Countdown timer for OTP resend
  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown(c => (c > 0 ? c - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [step, countdown])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (signup && !name.trim()) { setError('Name is required.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    try {
      const res = await fetch(signup ? '/api/register' : '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      // Check if user requires OTP verification
      if (data.needs_verification) {
        setTargetEmail(data.email || email.trim())
        setOtp(['', '', '', '', '', ''])
        setCountdown(60)
        setStep('otp')
        return
      }

      setUser(data.user)
      addToast(`Welcome back, ${data.user.name}!`, 'success')
      setScreen('app')
    } catch {
      setError('Cannot reach the server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (val, idx) => {
    const clean = val.replace(/\D/g, '')
    const char = clean.slice(-1)
    const nextOtp = [...otp]
    nextOtp[idx] = char
    setOtp(nextOtp)

    if (char && idx < 5) {
      otpInputsRef.current[idx + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === 'Backspace') {
      if (!otp[idx] && idx > 0) {
        otpInputsRef.current[idx - 1]?.focus()
      }
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const nextOtp = [...otp]
    for (let i = 0; i < 6; i++) {
      nextOtp[i] = pasted[i] || ''
    }
    setOtp(nextOtp)
    const targetIdx = Math.min(pasted.length, 5)
    otpInputsRef.current[targetIdx]?.focus()
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    const code = otp.join('')
    if (code.length < 6) {
      setError('Please enter all 6 digits of your verification code.')
      return
    }

    setVerifying(true)
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, otp: code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Invalid verification code.')
        return
      }

      setUser(data.user)
      addToast(`Welcome, ${data.user.name}!`, 'success')
      setScreen('app')
    } catch {
      setError('Cannot reach the server. Is the backend running?')
    } finally {
      setVerifying(false)
    }
  }

  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return
    setError('')
    setResending(true)
    try {
      const res = await fetch('/api/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not resend code.')
        return
      }
      addToast(`A new code was sent to ${targetEmail}`, 'success')
      setCountdown(60)
      setOtp(['', '', '', '', '', ''])
      otpInputsRef.current[0]?.focus()
    } catch {
      setError('Failed to resend verification code.')
    } finally {
      setResending(false)
    }
  }

  const handleGuest = async () => {
    try { await fetch('/api/logout', { method: 'POST' }) } catch {}
    setUser(null)
    setScreen('app')
  }

  const switchMode = () => {
    setMode(signup ? 'login' : 'signup')
    setError('')
    setStep('form')
  }

  return (
    <div className="au-page">
      {/* ---------- Visual panel ---------- */}
      <section className="au-visual">
        <div className="au-blob b1" /><div className="au-blob b2" /><div className="au-blob b3" />

        <div className="au-brand">
          <span className="au-brand-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l5-5 4 4 7-8" /><path d="M15 8h5v5" /></svg>
          </span>
          FinAI
        </div>

        <h2 className="au-headline">Smart money,<br /><span>made simple.</span></h2>

        <div className="au-stage" aria-hidden="true">
          <div className="au-glass au-balance">
            <div className="au-row"><small>Total Balance</small><em className="au-up">▲ 12.4%</em></div>
            <strong>₹1,24,580</strong>
            <svg viewBox="0 0 200 54" preserveAspectRatio="none">
              <defs><linearGradient id="spark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7b5cff" stopOpacity=".35" /><stop offset="1" stopColor="#7b5cff" stopOpacity="0" /></linearGradient></defs>
              <path d="M0 44 C20 40 28 18 50 26 S84 46 106 30 S146 6 170 14 S190 8 200 4 L200 54 L0 54Z" fill="url(#spark)" />
              <path d="M0 44 C20 40 28 18 50 26 S84 46 106 30 S146 6 170 14 S190 8 200 4" fill="none" stroke="#7b5cff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          <div className="au-card3d">
            <span className="au-chip" />
            <div><small>FinAI Platinum</small><b>₹ 84,635.00</b></div>
            <i>•••• •••• •••• 8824</i>
          </div>

          <div className="au-glass au-goal">
            <div className="au-ring"><b>68%</b></div>
            <div><small>Savings goal</small><strong>₹68k / ₹1L</strong></div>
          </div>

          <div className="au-glass au-spend">
            <small>Top spending</small>
            <div className="au-bars"><i style={{ '--h': '58%' }} /><i style={{ '--h': '88%' }} /><i style={{ '--h': '42%' }} /><i style={{ '--h': '70%' }} /><i style={{ '--h': '34%' }} /></div>
          </div>

          <span className="au-coin c1">₹</span>
          <span className="au-coin c2">₹</span>
        </div>

        <div className="au-copy">
          <h3>Intelligent Finance Assistance</h3>
          <p>Track every rupee, set smarter budgets and chat with an AI that answers from your own numbers.</p>
        </div>
      </section>

      {/* ---------- Right: card section ---------- */}
      <section className="au-side">
        <div className="au-card">
          <button type="button" className="au-goback" onClick={() => step === 'otp' ? setStep('form') : setScreen('landing')}>
            <ArrowLeft size={15} /> {step === 'otp' ? 'Back' : 'Back'}
          </button>

          <div className="au-logo">
            {step === 'otp' ? (
              <KeyRound size={22} />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 17l5-5 4 4 7-8" /><path d="M15 8h5v5" />
              </svg>
            )}
          </div>

          {step === 'otp' ? (
            /* ---------- OTP Verification Step ---------- */
            <>
              <h1>Verify your email</h1>
              <p className="au-sub">We sent a 6-digit code to <strong>{targetEmail}</strong></p>

              {error && <div className="au-error" role="alert">{error}</div>}

              <form onSubmit={handleVerifyOtp} noValidate>
                <div className="au-otp-grid" onPaste={handleOtpPaste}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => (otpInputsRef.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(e.target.value, idx)}
                      onKeyDown={e => handleOtpKeyDown(e, idx)}
                      className="au-otp-box"
                      autoComplete="one-time-code"
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>

                <button type="submit" className="au-submit" disabled={verifying || otp.join('').length < 6}>
                  {verifying ? 'Verifying code…' : 'Verify Email'}
                </button>

                <div className="au-otp-actions">
                  <button
                    type="button"
                    className="au-resend-btn"
                    onClick={handleResendOtp}
                    disabled={countdown > 0 || resending}
                  >
                    {countdown > 0 ? `Resend code in ${countdown}s` : resending ? 'Sending code…' : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    className="au-change-email"
                    onClick={() => { setStep('form'); setError('') }}
                  >
                    Change email
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* ---------- Standard Login / Sign-up Step ---------- */
            <>
              <h1>{signup ? 'Create Account' : 'Welcome Back'}</h1>
              <p className="au-sub">{signup ? 'Start managing your personal finances' : 'Sign in to access your finance dashboard'}</p>

              {error && <div className="au-error" role="alert">{error}</div>}

              {/* Continue with Google button */}
              <button
                type="button"
                className="au-google"
                onClick={() => { window.location.href = '/api/auth/google' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="au-or"><span>or with email</span></div>

              <form onSubmit={handleSubmit} noValidate>
                {signup && (
                  <label className="au-field">
                    <span>Name</span>
                    <div className="au-input">
                      <User size={16} />
                      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
                    </div>
                  </label>
                )}
                <label className="au-field">
                  <span>Email</span>
                  <div className="au-input">
                    <Mail size={16} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                  </div>
                </label>
                <label className="au-field">
                  <span>Password</span>
                  <div className="au-input">
                    <Lock size={16} />
                    <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={signup ? 'new-password' : 'current-password'} />
                    <button type="button" className="au-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <button type="submit" className="au-submit" disabled={loading}>
                  {loading ? 'Please wait…' : signup ? 'Create Account' : 'Sign In'}
                </button>
              </form>

              <div className="au-or"><span>Other options</span></div>
              <button className="au-guest" onClick={handleGuest}>Continue as Guest (No Login)</button>

              <p className="au-switch">
                {signup ? 'Already have an account?' : "Don't have an account?"}{' '}
                <a href="#" onClick={e => { e.preventDefault(); switchMode() }}>{signup ? 'Sign in' : 'Sign up'}</a>
              </p>
            </>
          )}
        </div>

        <div className="au-strip">
          <div className="au-strip-icon"><ShieldCheck size={20} /></div>
          <div>
            <strong>Private by design</strong>
            <span>Your data is saved only in your own account</span>
          </div>
          <button className="au-back" onClick={() => setScreen('landing')}><ArrowLeft size={14} /> Home</button>
        </div>
      </section>
    </div>
  )
}