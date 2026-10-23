import React, { useRef } from 'react'
import { ScanSearch, Sparkles, CalendarCheck2 } from 'lucide-react'
import '../authvisual.css'

const WORD = 'potential'

/** Right-hand visual of the login page — same look as the landing page (3D rotating coin). */
export default function AuthVisual() {
  const stageRef = useRef(null)

  const onMove = (e) => {
    const el = stageRef.current
    if (!el || window.matchMedia('(pointer: coarse)').matches) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--tx', (-y * 13).toFixed(2) + 'deg')
    el.style.setProperty('--ty', (x * 16).toFixed(2) + 'deg')
    el.style.setProperty('--mx', (x * 24).toFixed(2) + 'px')
    el.style.setProperty('--my', (y * 20).toFixed(2) + 'px')
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
    <section className="au-visual av" aria-label="FinAI" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="av-watermark" aria-hidden="true">FINANCE</div>

      <div className="av-brand">Fin<em>AI</em></div>

      <h2 className="av-head">
        <span className="av-line" style={{ '--d': '100ms' }}>Unlock your</span>
        <span className="av-line" style={{ '--d': '200ms' }}>money's</span>
        <span className="av-line av-word" aria-label={WORD}>
          {WORD.split('').map((c, i) => <span key={i} style={{ '--i': i }} aria-hidden="true">{c}</span>)}
        </span>
      </h2>

      <div className="av-stage" ref={stageRef} aria-hidden="true">
        <div className="av-glow" />
        <div className="av-orbit orbit-a" />
        <div className="av-orbit orbit-b" />
        <div className="av-tilt">
          <div className="av-float">
            <div className="av-coin">
              <div className="av-face front"><span>₹</span></div>
              {Array.from({ length: 22 }, (_, i) => <div key={i} className="av-edge" style={{ '--i': i }} />)}
              <div className="av-face back"><span>₹</span></div>
            </div>
            <div className="av-scan" />
          </div>
        </div>
        <div className="av-shadow" />
        <span className="av-mini m1">₹</span>
        <span className="av-mini m2">₹</span>
        <span className="av-mini m3">₹</span>
        <i className="av-spark s1" /><i className="av-spark s2" /><i className="av-spark s3" />
        <div className="av-frame f1"><u /><em>Income</em></div>
        <div className="av-frame f2"><u /><em>Savings 24%</em></div>
        <div className="av-frame f3"><u /><em>Risk: Low</em></div>
        <div className="av-metric-card mc1"><small>Monthly</small><b>+12%</b></div>
        <div className="av-metric-card mc2"><small>AI scan</small><b>Ready</b></div>
      </div>

      <div className="av-chips">
        <div><ScanSearch size={16} /><b>100%</b><small>grounded in your data</small></div>
        <div><Sparkles size={16} /><b>15+</b><small>spending insights</small></div>
        <div><CalendarCheck2 size={16} /><b>1-day</b><small>personalised budget</small></div>
      </div>
    </section>
  )
}
