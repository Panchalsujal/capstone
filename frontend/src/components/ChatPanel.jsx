import { useState, useRef, useEffect, useCallback } from 'react'
import { marked } from 'marked'

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true
})

// Parse SSE stream lines into events
function parseSSELine(line) {
  if (line.startsWith('event:')) return { type: 'event', value: line.slice(6).trim() }
  if (line.startsWith('data:')) return { type: 'data', value: line.slice(5).trim() }
  return null
}

export default function ChatPanel({ sandboxId, session, onUpdateSession, onNewSession }) {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [toasts, setToasts] = useState([])
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const abortRef = useRef(null)

  const messages = session?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const addToast = useCallback((text) => {
    const id = Date.now()
    setToasts(t => [...t, { id, text }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  async function sendMessage() {
    if (!input.trim() || isStreaming) return
    const userText = input.trim()
    setInput('')

    // Ensure session exists
    if (!session) {
      onNewSession()
      return
    }

    const userMsg = { role: 'user', content: userText, id: Date.now().toString() }

    // Add user message + empty AI placeholder
    const aiMsg = { role: 'assistant', content: '', id: (Date.now() + 1).toString(), streaming: true }
    onUpdateSession(session.id, s => ({
      messages: [...s.messages, userMsg, aiMsg],
      title: s.title === 'New Chat' ? userText.slice(0, 40) : s.title,
    }))

    setIsStreaming(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/ai/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({ message: userText, sandboxId }),
        signal: ctrl.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''
      let accText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // Keep incomplete line

        for (const line of lines) {
          const parsed = parseSSELine(line)
          if (!parsed) continue

          if (parsed.type === 'event') {
            currentEvent = parsed.value
          } else if (parsed.type === 'data') {
            try {
              const json = JSON.parse(parsed.value)

              if (currentEvent === 'token' && json.text) {
                accText += json.text
                // Show toast for file ops
                if (json.text.includes('Creating') || json.text.includes('Updating') || json.text.includes('Reading')) {
                  addToast(json.text.trim())
                }
                // Update streaming AI message
                onUpdateSession(session.id, s => ({
                  messages: s.messages.map(m =>
                    m.id === aiMsg.id ? { ...m, content: accText } : m
                  )
                }))
              } else if (currentEvent === 'done') {
                // Finalize last AI message
                onUpdateSession(session.id, s => ({
                  messages: s.messages.map(m =>
                    m.id === aiMsg.id ? { ...m, content: accText || m.content, streaming: false } : m
                  )
                }))
              } else if (currentEvent === 'error') {
                throw new Error(json.error || 'Agent error')
              }
            } catch (e) {
              if (e.name !== 'SyntaxError') throw e
            }
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return
      onUpdateSession(session.id, s => ({
        messages: s.messages.map(m =>
          m.id === aiMsg.id ? { ...m, content: m.content || 'Error: ' + e.message, streaming: false, error: true } : m
        )
      }))
    } finally {
      setIsStreaming(false)
      // Mark streaming done
      onUpdateSession(session.id, s => ({
        messages: s.messages.map(m => m.streaming ? { ...m, streaming: false } : m)
      }))
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-forge-bg h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-forge-border bg-forge-panel shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forge-card border border-forge-border">
            <span className="w-1.5 h-1.5 rounded-full bg-forge-green animate-pulse" />
            <span className="text-xs text-forge-green font-medium">Running</span>
          </div>
          <code className="text-[10px] font-mono text-forge-muted bg-forge-card px-2 py-1 rounded">
            {sandboxId?.slice(0, 8)}…
          </code>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-1.5 text-xs text-forge-purple">
              <div className="flex gap-0.5">
                <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-forge-purple" />
                <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-forge-purple" />
                <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-forge-purple" />
              </div>
              Thinking
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col flex-1 overflow-y-auto px-6 py-6 gap-6 min-h-0">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map(msg => (
            <Message key={msg.id} msg={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-24 right-96 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="toast-slide flex items-center gap-2 px-3 py-2 rounded-lg glass text-xs text-forge-text max-w-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-forge-purple shrink-0" />
            <span className="truncate">{t.text}</span>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div className="px-6 pb-6 pt-4 shrink-0 border-t border-forge-border">
        <div className="glass rounded-2xl p-4 focus-within:border-forge-purple focus-within:[box-shadow:0_0_0_2px_rgba(124,58,237,0.2)] transition-all duration-200">
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={session ? 'Ask AI to build anything...' : 'Start a new chat first'}
            disabled={!session || isStreaming}
            rows={1}
            className="w-full bg-transparent text-forge-text text-sm placeholder-forge-muted resize-none outline-none min-h-9"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[10px] text-forge-muted">Enter to send · Shift+Enter for newline</span>
            <div className="flex items-center gap-2">
              {isStreaming && (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="text-xs text-forge-muted hover:text-forge-red transition-colors px-3 py-2 rounded-lg hover:bg-forge-card border border-forge-border"
                >
                  Stop
                </button>
              )}
              <button
                id="send-btn"
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming || !session}
                className="w-10 h-10 rounded-xl bg-linear-to-br from-forge-purple to-forge-indigo
                  hover:from-forge-purple-dim hover:to-forge-indigo-dim
                  disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center transition-all duration-200 shadow-md"
              >
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'

  const renderContent = () => {
    if (isUser) {
      return msg.content
    }
    const rawContent = msg.content || (msg.streaming && !msg.error ? '' : '…')
    // Parse markdown to html safely
    const html = marked.parse(rawContent)
    return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold
        ${isUser
          ? 'bg-linear-to-br from-forge-purple to-forge-indigo text-white'
          : 'bg-forge-card border border-forge-border text-forge-muted'}`}>
        {isUser ? 'U' : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4l5-3 5 3v8l-5 3-5-3V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-linear-to-br from-forge-purple to-forge-indigo text-white rounded-tr-sm whitespace-pre-wrap'
            : `bg-forge-panel border border-forge-border text-forge-text rounded-tl-sm
               ${msg.error ? 'border-forge-red bg-forge-red/5' : ''}`
          }`}>
          {renderContent()}
          {msg.streaming && <span className="cursor-blink inline-block w-0.5 h-4 bg-forge-purple ml-0.5 align-middle" />}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-forge-purple/20 to-forge-indigo/20 border border-forge-purple/30 flex items-center justify-center mb-6 shadow-lg">
        <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
          <path d="M2 4l5-3 5 3v8l-5 3-5-3V4z" stroke="#7c3aed" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M7 1v14M2 4l5 3 5-3" stroke="#7c3aed" strokeWidth="1" strokeLinejoin="round" opacity="0.6"/>
        </svg>
      </div>

      {/* Heading */}
      <h3 className="text-forge-text font-semibold text-base mb-3">Start building with AI</h3>

      {/* Subtext */}
      <p className="text-forge-muted text-sm leading-relaxed max-w-sm mb-8">
        Describe what you want to create and the AI will write, update, and organize your code files.
      </p>

      {/* Example chips */}
      <div className="grid grid-cols-1 gap-2 text-left w-full max-w-sm">
        {[
          'Create a snake game',
          'Build a todo app with local storage',
          'Make the CSS look more modern',
        ].map(s => (
          <div key={s} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-forge-panel border border-forge-border text-xs text-forge-muted hover:border-forge-purple/50 hover:text-forge-text hover:bg-forge-card cursor-pointer transition-all duration-150">
            <span className="text-forge-purple opacity-60">›</span>
            &ldquo;{s}&rdquo;
          </div>
        ))}
      </div>
    </div>
  )
}
