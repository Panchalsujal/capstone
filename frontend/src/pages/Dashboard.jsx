import { useParams, useLocation } from 'react-router-dom'
import { useState, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import ChatPanel from '../components/ChatPanel'
import RightPanel from '../components/RightPanel'

export default function Dashboard() {
  const { sandboxId } = useParams()
  const { state } = useLocation()
  const previewUrl = state?.previewUrl || `http://${sandboxId}.preview.localhost`
  const agentBase = `http://${sandboxId}.agent.localhost`

  // Global sessions stored in localStorage
  const storageKey = `codeforge_sessions_${sandboxId}`
  const [sessions, setSessions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]')
    } catch { return [] }
  })
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0]?.id || null)

  const persistSessions = useCallback((updated) => {
    setSessions(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }, [storageKey])

  // Create a new chat session
  const newSession = useCallback(() => {
    const id = Date.now().toString()
    const session = { id, title: 'New Chat', messages: [], createdAt: new Date().toISOString() }
    persistSessions([session, ...sessions])
    setActiveSessionId(id)
  }, [sessions, persistSessions])

  // Update messages of the active session
  const updateSession = useCallback((sessionId, updater) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, ...updater(s) } : s)
      localStorage.setItem(storageKey, JSON.stringify(updated))
      return updated
    })
  }, [storageKey])

  const activeSession = sessions.find(s => s.id === activeSessionId) || null

  // Initialize with a first session if empty
  if (sessions.length === 0 && activeSessionId === null) {
    const id = Date.now().toString()
    const session = { id, title: 'New Chat', messages: [], createdAt: new Date().toISOString() }
    persistSessions([session])
    setActiveSessionId(id)
  }

  return (
    <div className="flex flex-1 h-full w-full overflow-hidden bg-forge-bg">
      {/* Left Panel: Chat History */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={newSession}
        sandboxId={sandboxId}
      />

      {/* Divider */}
      <div className="w-px bg-forge-border shrink-0" />

      {/* Center Panel: AI Chat */}
      <ChatPanel
        sandboxId={sandboxId}
        session={activeSession}
        onUpdateSession={updateSession}
        onNewSession={newSession}
      />

      {/* Divider */}
      <div className="w-px bg-forge-border shrink-0" />

      {/* Right Panel: Files + Preview */}
      <RightPanel
        sandboxId={sandboxId}
        agentBase={agentBase}
        previewUrl={previewUrl}
      />
    </div>
  )
}
