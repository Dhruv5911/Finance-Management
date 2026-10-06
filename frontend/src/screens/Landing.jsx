import React from 'react'
import { TrendingUp, Zap, BarChart2, DollarSign, ArrowRight } from 'lucide-react'
import { useApp } from '../App'

const FEATURES = [
  { icon: BarChart2, title: 'Real Analytics', desc: 'Category spending, savings rate, and monthly cashflow trends in interactive charts.' },
  { icon: Zap, title: 'FinAI Assistant', desc: 'Ask anything about your finances. Powered by Gemini AI with deterministic Python tools.' },
  { icon: DollarSign, title: 'Budget & Goal Planners', desc: 'Set targets per category and calculate your path to savings milestones.' },
  { icon: TrendingUp, title: 'EMI & SIP Calculators', desc: 'Reducing-balance EMI, SIP compound growth, and live currency converter.' },
]

export default function Landing() {
  const { setScreen } = useApp()

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="landing-brand">Fin<em>AI</em></span>
        <div className="landing-nav-actions">
          <button className="btn-ghost" onClick={() => setScreen('auth')}>Log In</button>
          <button className="btn-primary" onClick={() => setScreen('app')}>Launch App →</button>
        </div>
      </nav>

      <section className="landing-hero">
        <div>
          <span className="landing-eyebrow">✦ Smart Personal Finance & AI</span>
          <h1>Accelerate your <span className="accent">financial clarity.</span></h1>
          <p>Track income and expenses, set monthly budgets, monitor trends, and converse with an intelligent AI assistant grounded in your real financial data.</p>
          <div className="landing-hero-actions">
            <button className="btn-primary" style={{ padding: '12px 28px', fontSize: 15 }} onClick={() => setScreen('auth')}>
              Get Started Free
              <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 6 }} />
            </button>
            <button className="btn-ghost" style={{ padding: '12px 24px' }} onClick={() => setScreen('app')}>
              Skip login & launch
            </button>
          </div>
          <div className="landing-stats">
            <div className="landing-stat"><strong>100%</strong><span>Grounded data</span></div>
            <div className="landing-stat"><strong>₹0</strong><span>Free & private</span></div>
            <div className="landing-stat"><strong>AI</strong><span>Gemini + RAG</span></div>
          </div>
        </div>

        <div className="landing-visual">
          <div className="vcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em' }}>FINAI</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>PLATINUM</div>
              </div>
              <div className="vcard-chip" />
            </div>
            <div>
              <div className="vcard-balance-label">TOTAL BALANCE</div>
              <div className="vcard-balance">₹84,635.00</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="vcard-number">•••• •••• •••• 8824</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>EXP 12/29</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="float-card">
              <div className="float-card-dot" style={{ background: 'var(--green)' }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>↑ Monthly Income</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>₹50,000</div>
              </div>
            </div>
            <div className="float-card">
              <div className="float-card-dot" style={{ background: 'var(--accent)' }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>↓ Savings Rate</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>24.5%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features">
        {FEATURES.map(f => (
          <div className="feature-card" key={f.title}>
            <div className="feature-icon"><f.icon size={20} /></div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
