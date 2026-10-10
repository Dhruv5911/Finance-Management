import React, { useState, useRef, useEffect } from 'react'
import {
  ArrowUp, Plus, Copy, Check, Sparkles, Database,
  PiggyBank, ChartPie, HeartPulse, Wallet, ListChecks, TrendingUp, ShieldCheck,
} from 'lucide-react'
import { useApp } from '../App'
import '../assistant.css'

const TOOL_LABELS = {
  get_savings_rate: 'Savings Rate',
  get_total_income: 'Income Calc',
  get_total_expenses: 'Expense Calc',
  get_balance: 'Balance',
  get_recent_transactions: 'Transactions',
  get_category_spending: 'Category Analysis',
  get_monthly_summary: 'Monthly Trends',
  get_financial_health_score: 'Health Score',
  generate_spending_insights: 'Spending Insights',
  suggest_budget: 'Budget Planner',
  rag_retrieve_context: 'Knowledge Base',
}

// The four big suggestion cards under the prompt box
const CARDS = [
  { icon: PiggyBank, title: 'Check my savings rate', desc: 'See how much of your income you keep each month.', query: 'What is my savings rate?', meta: 'Income · Savings' },
  { icon: ChartPie, title: 'Break down my spending', desc: 'Find out which categories take most of your money.', query: 'Show me expense by category', meta: 'Categories · Charts' },
  { icon: HeartPulse, title: 'Score my financial health', desc: 'Get a simple health score with what to improve.', query: 'How is my financial health?', meta: 'Health · Tips' },
  { icon: Wallet, title: 'Build me a budget', desc: 'A 50/30/20 plan based on your real numbers.', query: 'Suggest a budget for me', meta: 'Budget · 50/30/20' },
]

// Smaller quick chips
const CHIPS = [
  { icon: ListChecks, label: 'Recent transactions', query: 'Show my recent transactions' },
  { icon: TrendingUp, label: 'Explain SIP', query: 'What is a SIP and how does it work?' },
  { icon: ShieldCheck, label: 'Emergency fund', query: 'What is an emergency fund and how much do I need?' },
]

/* ---------- tiny, safe markdown renderer (headings, bold, bullets) ---------- */
function inline(text, keyBase) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={keyBase + i}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={keyBase + i}>{part}</React.Fragment>
  )
}

function Markdown({ text }) {
  const lines = String(text || '').split('\n')
  const out = []
  let list = []
  const flush = () => {
    if (list.length) { out.push(<ul key={'ul' + out.length}>{list}</ul>); list = [] }
  }
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    const heading = line.match(/^#{1,4}\s+(.*)$/)
    if (bullet) {
      list.push(<li key={idx}>{inline(bullet[1], idx + 'b')}</li>)
      return
    }
    flush()
    if (!line.trim()) return
    if (/^-{3,}$/.test(line.trim())) { out.push(<hr key={idx} />); return }
    if (heading) { out.push(<h4 key={idx}>{inline(heading[1], idx + 'h')}</h4>); return }
    out.push(<p key={idx}>{inline(line, idx + 'p')}</p>)
  })
  flush()
  return <div className="ai-md">{out}</div>
}

function Orb({ size = 132 }) {
  return (
    <div className="ai-orb" style={{ width: size, height: size }} aria-hidden="true">
      <span className="ai-orb-swirl" />
      <span className="ai-orb-shine" />
    </div>
  )
}

export default function ChatView() {
  const { user, transactions } = useApp()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(null)
  const endRef = useRef(null)
  const textareaRef = useRef(null)

  const name = user?.name?.split(' ')[0] || 'there'
  const chatting = messages.length > 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // auto-grow the prompt box
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input, chatting])

  const stamp = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const send = async (query) => {
    const q = (typeof query === 'string' ? query : input).trim()
    if (!q || sending) return
    setInput('')
    setSending(true)
    setMessages(m => [...m, { role: 'user', content: q, time: stamp() }])

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      })
      const d = await r.json()
      setMessages(m => [...m, {
        role: 'assistant',
        content: d.answer || 'Sorry, I could not process that.',
        tools: d.tools_used || [],
        time: stamp(),
      }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Network error. Is the server running on port 5000?', time: stamp() }])
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const newChat = async () => {
    setMessages([])
    setInput('')
    try { await fetch('/api/clear-chat', { method: 'POST' }) } catch {}
  }

  const copy = async (text, i) => {
    try { await navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 1500) } catch {}
  }

  const hasData = transactions.length > 0

  const composer = (
    <div className="ai-composer">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Ask FinAI anything about your money…"
        rows={chatting ? 1 : 3}
        aria-label="Message FinAI"
      />
      <div className="ai-composer-row">
        <div className="ai-composer-tags">
          <span className={`ai-tag ${hasData ? 'ok' : ''}`}>
            <Database size={13} />
            {hasData ? `${transactions.length} transactions loaded` : 'No data yet — add transactions for personal answers'}
          </span>
        </div>
        <button className="ai-send" onClick={() => send()} disabled={!input.trim() || sending} aria-label="Send">
          <ArrowUp size={18} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  )

  return (
    <div className={`ai-page ${chatting ? 'is-chatting' : ''}`}>
      <div className="ai-head">
        <div>
          <h1>Ask <span>FinAI</span></h1>
          <p>Hey {name}! I'm your AI finance agent. I can help you.</p>
        </div>
        <button className="btn-primary" onClick={newChat}>
          <Plus size={16} /> New chat
        </button>
      </div>

      {!chatting ? (
        <div className="ai-hero">
          <div className="bento-in" style={{ '--i': 0 }}><Orb /></div>
          <h2 className="ai-hello bento-in" style={{ '--i': 1 }}>
            Hello, <span>how can I help?</span>
          </h2>
          <div className="ai-composer-wrap bento-in" style={{ '--i': 2 }}>{composer}</div>

          <div className="ai-chips bento-in" style={{ '--i': 3 }}>
            {CHIPS.map(c => (
              <button key={c.label} className="ai-chip" onClick={() => send(c.query)}>
                <c.icon size={14} /> {c.label}
              </button>
            ))}
          </div>

          <div className="ai-cards">
            {CARDS.map((c, i) => (
              <button key={c.title} className="ai-card bento-in" style={{ '--i': 4 + i }} onClick={() => send(c.query)}>
                <span className="ai-card-icon"><c.icon size={18} /></span>
                <span className="ai-card-title">{c.title}</span>
                <span className="ai-card-desc">{c.desc}</span>
                <span className="ai-card-meta"><Sparkles size={12} /> {c.meta}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="ai-thread">
            <div className="ai-thread-inner">
              {messages.map((m, i) => (
                <div className={`ai-msg ${m.role}`} key={i}>
                  {m.role === 'assistant' && <div className="ai-msg-avatar"><Orb size={34} /></div>}
                  <div className="ai-msg-body">
                    <div className="ai-bubble">
                      {m.role === 'assistant' ? <Markdown text={m.content} /> : <p>{m.content}</p>}
                      {m.tools?.length > 0 && (
                        <div className="ai-tools">
                          {m.tools.map(t => <span key={t} className="tool-badge">⚙ {TOOL_LABELS[t] || t}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="ai-meta">
                      {m.time}
                      {m.role === 'assistant' && (
                        <button className="ai-copy" onClick={() => copy(m.content, i)} aria-label="Copy answer">
                          {copied === i ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {sending && (
                <div className="ai-msg assistant">
                  <div className="ai-msg-avatar"><Orb size={34} /></div>
                  <div className="ai-msg-body">
                    <div className="ai-bubble ai-typing">
                      <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                      <em>FinAI is thinking…</em>
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <div className="ai-dock">{composer}</div>
        </>
      )}
    </div>
  )
}