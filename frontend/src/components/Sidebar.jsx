import { useNavigate } from 'react-router-dom'

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

export default function Sidebar({ sessions, activeSessionId, onSelectSession, onNewSession, sandboxId }) {
  const navigate = useNavigate()

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-forge-panel h-full overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-forge-border">
        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-forge-purple to-forge-indigo flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4l5-3 5 3v8l-5 3-5-3V4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M7 1v14M2 4l5 3 5-3" stroke="white" strokeWidth="1" strokeLinejoin="round" opacity="0.6"/>
          </svg>
        </div>
        <div className="min-w-0">
          <span className="font-semibold text-forge-text text-sm">CodeForge</span>
          <p className="text-[10px] text-forge-muted font-mono truncate mt-0.5">{sandboxId?.slice(0, 12)}…</p>
        </div>
      </div>

      {/* Section label */}
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-forge-muted">Chat History</span>
        <span className="text-[10px] text-forge-muted bg-forge-card px-1.5 py-0.5 rounded-full">{sessions.length}</span>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-3">
        {sessions.length === 0 ? (
          <p className="text-center text-xs text-forge-muted py-10 px-4">No chats yet. Start a conversation!</p>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-150 group
                ${activeSessionId === session.id
                  ? 'bg-forge-purple/10 border-l-2 border-forge-purple text-forge-text'
                  : 'hover:bg-forge-card text-forge-muted hover:text-forge-text border-l-2 border-transparent'
                }`}
            >
              <div className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{session.title}</p>
                  {session.messages.length > 0 && (
                    <p className="text-[10px] text-forge-muted truncate mt-0.5">
                      {session.messages[session.messages.length - 1]?.content?.slice(0, 40) || ''}
                    </p>
                  )}
                </div>
                <span className="text-[9px] text-forge-muted shrink-0 mt-0.5">{timeAgo(session.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* New Chat + Back to Home */}
      <div className="p-4 border-t border-forge-border space-y-2.5">
        <button
          id="new-chat-btn"
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl
            bg-linear-to-r from-forge-purple to-forge-indigo hover:from-forge-purple-dim hover:to-forge-indigo-dim
            text-white text-xs font-semibold transition-all duration-200 shadow-md"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          New Chat
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            text-forge-muted hover:text-forge-text hover:bg-forge-card text-xs transition-all duration-150 border border-forge-border hover:border-forge-purple/30"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
            <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          New Sandbox
        </button>
      </div>
    </aside>
  )
}
