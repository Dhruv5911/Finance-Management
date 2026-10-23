import React, { useRef } from 'react'
import { ArrowRight, ScanSearch, Sparkles, CalendarCheck2, BarChart2, Wallet, Calculator, MessageCircle, Lock, ShieldCheck, KeyRound, TrendingUp, PieChart } from 'lucide-react'
import { useApp } from '../App'
import useCountUp from '../useCountUp'
import '../landing.css'

const WORD = 'potential'

const FEATURES = [
  { icon: BarChart2, title: 'Real Analytics', desc: 'Category spending, savings rate and monthly trends in clear charts.' },
  { icon: Wallet, title: 'Budgets & Goals', desc: 'Set a limit per category and track your path to savings goals.' },
  { icon: Calculator, title: 'EMI & SIP Tools', desc: 'Loan EMI, SIP growth and a live currency converter built in.' },
  { icon: ScanSearch, title: 'Receipt & Statement Scan', desc: 'Snap a bill or upload a bank PDF and transactions fill in for you.' },
]
const SECURITY = [
  { icon: KeyRound, title: 'Email OTP verification', desc: 'A 6-digit code confirms your email at sign-up.' },
  { icon: Lock, title: 'Hashed passwords', desc: 'Passwords and codes are stored scrambled, never in plain text.' },
  { icon: ShieldCheck, title: 'Your data stays yours', desc: 'Each account only ever sees its own transactions.' },
]
const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function Stat({ icon: Icon, to, suffix, label, delay }) {
  const v = useCountUp(to, 1400)
  return (
    <div className="lp-stat" style={{ '--d': delay + 'ms' }}>
      <span className="lp-stat-ico"><Icon size={20} strokeWidth={1.6} /></span>
      <div>
        <b>{Math.round(v)}{suffix}</b>
        <small>{label}</small>
      </div>
    </div>
  )
}

export default function Landing() {
  const { setScreen } = useApp()
  const stageRef = useRef(null)

  // coin leans toward the mouse (desktop only)
  const onMove = (e) => {
    const el = stageRef.current
    if (!el || window.matchMedia('(pointer: coarse)').matches) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--tx', (-y * 13).toFixed(2) + 'deg')
    el.style.setProperty('--ty', (x * 16).toFixed(2) + 'deg')
    el.style.setProperty('--mx', (x * 28).toFixed(2) + 'px')
    el.style.setProperty('--my', (y * 22).toFixed(2) + 'px')
  }

  const onLeave = () => {
    const el = stageRef.current
    if (!el) return
    el.style.setProperty('--tx', '0deg')
    el.style.setProperty('--ty', '0deg')
    el.style.setProperty('--mx', '0px')
    el.style.setProperty('--my', '0px')
  }

  return (
    <div className="lp" onMouseMove={onMove} onMouseLeave={onLeave}>
      <nav className="lp-nav">
        <span className="lp-brand">Fin<em>AI</em></span>
        <div className="lp-links">
          <a href="#features" onClick={e => { e.preventDefault(); go('features') }}>Features</a>
          <a href="#assistant" onClick={e => { e.preventDefault(); go('assistant') }}>AI Assistant</a>
          <a href="#security" onClick={e => { e.preventDefault(); go('security') }}>Security</a>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-btn-outline" onClick={() => setScreen('auth')}>Log In</button>
          <button className="lp-btn-dark" onClick={() => setScreen('app')}>Launch App <ArrowRight size={14} /></button>
        </div>
      </nav>

      <div className="lp-hero">
      <div className="lp-watermark" aria-hidden="true">FINANCE</div>
      <main className="lp-main">
        {/* ---------- Headline ---------- */}
        <section className="lp-copy">
          <h1>
            <span className="lp-line" style={{ '--d': '100ms' }}>Unlock</span>
            <span className="lp-line" style={{ '--d': '220ms' }}>your money's</span>
            <span className="lp-line lp-word" aria-label={WORD}>
              {WORD.split('').map((c, i) => (
                <span key={i} style={{ '--i': i }} aria-hidden="true">{c}</span>
              ))}
            </span>
          </h1>
          <p className="lp-sub">Our AI reads your spending and shows what can be improved.</p>
          <div className="lp-pills" aria-label="Finance highlights">
            <span><TrendingUp size={14} /> Savings trends</span>
            <span><PieChart size={14} /> Category clarity</span>
            <span><ShieldCheck size={14} /> Private account</span>
          </div>
          <div className="lp-cta">
            <button className="lp-btn-dark lg" onClick={() => setScreen('auth')}>Get Started Free <ArrowRight size={16} /></button>
            <button className="lp-btn-soft lg" onClick={() => setScreen('app')}>Skip login & launch</button>
          </div>
          <div className="lp-trust">
            <div className="lp-avatars"><i /><i /><i /></div>
            <span>Trusted by students</span>
          </div>
        </section>

        {/* ---------- 3D coin ---------- */}
        <section className="lp-stage" ref={stageRef} aria-hidden="true">
          <div className="lp-glow" />
          <div className="lp-orbit orbit-a" />
          <div className="lp-orbit orbit-b" />
          <div className="lp-tilt">
            <div className="lp-float">
              <div className="lp-coin">
                <div className="lp-face front"><span>₹</span></div>
                {Array.from({ length: 22 }, (_, i) => (
                  <div key={i} className="lp-edge" style={{ '--z': `${(i - 10.5) * 2.6}px` }} />
                ))}
                <div className="lp-face back"><span>₹</span></div>
              </div>
              <div className="lp-scan" />
            </div>
          </div>
          <div className="lp-shadow" />

          <span className="lp-mini m1">₹</span>
          <span className="lp-mini m2">₹</span>
          <span className="lp-mini m3">₹</span>
          <i className="lp-spark s1" /><i className="lp-spark s2" /><i className="lp-spark s3" />

          <div className="lp-frame f1"><u /><em>Income</em></div>
          <div className="lp-frame f2"><u /><em>Savings 24%</em></div>
          <div className="lp-frame f3"><u /><em>Risk: Low</em></div>
          <div className="lp-metric-card mc1"><small>Cashflow</small><b>+18%</b></div>
          <div className="lp-metric-card mc2"><small>Budget</small><b>On track</b></div>
        </section>

        {/* ---------- Stats ---------- */}
        <aside className="lp-stats">
          <Stat icon={ScanSearch} to={100} suffix="%" label="grounded in your data" delay={500} />
          <Stat icon={Sparkles} to={15} suffix="+" label="spending insights" delay={650} />
          <Stat icon={CalendarCheck2} to={1} suffix="-day" label="personalised budget" delay={800} />
        </aside>
      </main>
      </div>

      <section className="lp-sec" id="features">
        <h2>Everything you need to <span>understand your money</span></h2>
        <div className="lp-grid4">
          {FEATURES.map(f => (
            <div className="lp-card" key={f.title}>
              <span className="lp-card-ico"><f.icon size={20} /></span>
              <h3>{f.title}</h3><p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-sec lp-split" id="assistant">
        <div>
          <span className="lp-tag"><MessageCircle size={13} /> AI Assistant</span>
          <h2>Ask your money <span>anything.</span></h2>
          <p className="lp-lead">Chat with FinAI in plain words. It calculates from your own transactions and explains the answer in simple language, no guessing.</p>
          <button className="lp-btn-dark lg" onClick={() => setScreen('auth')}>Try it free <ArrowRight size={16} /></button>
        </div>
        <div className="lp-chat">
          <div className="lp-bub me">What is my savings rate?</div>
          <div className="lp-bub ai"><b>Savings rate: 24.5%</b><br />You saved ₹12,250 of ₹50,000 income. Cutting food delivery by ₹1,500 would lift it to 27.5%.</div>
          <div className="lp-bub me">Which category costs me most?</div>
          <div className="lp-bub ai"><b>Rent · ₹12,000</b><br />That is 32% of your spending, followed by Groceries at 14%.</div>
        </div>
      </section>

      <section className="lp-sec" id="security">
        <h2>Private and <span>secure by design</span></h2>
        <div className="lp-grid3">
          {SECURITY.map(f => (
            <div className="lp-card" key={f.title}>
              <span className="lp-card-ico"><f.icon size={20} /></span>
              <h3>{f.title}</h3><p>{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="lp-final">
          <button className="lp-btn-dark lg" onClick={() => setScreen('auth')}>Get Started Free <ArrowRight size={16} /></button>
        </div>
        <footer className="lp-foot">© FinAI · Personal finance with AI</footer>
      </section>
    </div>
  )
}
