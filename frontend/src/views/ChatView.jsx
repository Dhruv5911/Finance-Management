import React, { useState, useRef, useEffect } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { useApp } from '../App'

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

const QUICK = [
  { label: '💰 Savings Rate', query: 'What is my savings rate?' },
  { label: '📊 Category Breakdown', query: 'Show me expense by category' },
  { label: '📋 Recent Transactions', query: 'Show my recent transactions' },
  { label: '❤️ Financial Health', query: 'How is my financial health?' },
  { label: '📌 50/30/20 Budget', query: 'Suggest a budget for me' },
  { label: '📈 Explain SIP', query: 'What is a SIP and how does it work?' },
  { label: '🛡️ Emergency Fund', query: 'What is an emergency fund and how much do I need?' },
]

export default function ChatView() {
  const { } = useApp()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (query) => {
    const q = (query || input).trim()
    if (!q || sending) return
    setInput('')
    setSending(true)
    const userMsg = { role: 'user', content: q, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }
    setMessages(m => [...m, userMsg])

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
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Network error. Is the server running on port 5000?', time: '' }])
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearChat = async () => {
    setMessages([])
    try { await fetch('/api/clear-chat', { method: 'POST' }) } catch {}
  }

  return (
    <div className="chat-shell">
      <div className="chat-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="chat-avatar">✦</div>
          <div className="chat-title-wrap">
            <h3>Ask FinAI</h3>
            <p>Your AI personal finance assistant — grounded in your data</p>
          </div>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12, gap: 6, display: 'flex', alignItems: 'center' }} onClick={clearChat}>
          <Trash2 size={13} /> Clear Chat
        </button>
      </div>

      <div className="chat-messages">
        {/* Welcome */}
        {messages.length === 0 && (
          <div className="msg assistant">
            <div className="msg-avatar">✦</div>
            <div>
              <div className="msg-bubble">
                <p><strong>FinAI</strong> — Your Intelligent Personal Finance Assistant</p>
                <p>Ask anything about your income, spending, savings rate, budgets, or finance concepts. All calculations run deterministically with Python/pandas.</p>
                <div className="quick-chips">
                  {QUICK.map(q => (
                    <button key={q.label} className="chip" onClick={() => send(q.query)}>{q.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div className={`msg ${m.role}`} key={i}>
            <div className="msg-avatar">{m.role === 'user' ? 'U' : '✦'}</div>
            <div>
              <div className="msg-bubble">
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{m.content}</pre>
                {m.tools?.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap' }}>
                    {m.tools.map(t => (
                      <span key={t} className="tool-badge">⚙ {TOOL_LABELS[t] || t}</span>
                    ))}
                  </div>
                )}
              </div>
              {m.time && <div className="msg-meta">{m.time}</div>}
            </div>
          </div>
        ))}

        {sending && (
          <div className="msg assistant">
            <div className="msg-avatar">✦</div>
            <div className="msg-bubble" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>FinAI is thinking…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask FinAI anything about your finances…"
            rows={1}
            style={{ flex: 1, resize: 'none', minHeight: 44, maxHeight: 120, borderRadius: 12, padding: '10px 14px', fontSize: 14 }}
          />
          <button className="chat-send-btn" onClick={() => send()} disabled={!input.trim() || sending}>
            <Send size={18} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          Press <kbd style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>Enter</kbd> to send · <kbd style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  )
}
