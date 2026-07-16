import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle') // idle | loading | provisioning | error
  const [error, setError] = useState('')

  async function handleLaunch() {
    setStatus('loading')
    setError('')
    try {
      const res = await fetch('/api/sandbox/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to start sandbox')

      if (data.status === 'ready') {
        navigate(`/dashboard/${data.sandboxId}`, { state: { previewUrl: data.previewUrl } })
        return
      }

      // Poll until ready
      setStatus('provisioning')
      await pollStatus(data.sandboxId, data.previewUrl)
    } catch (e) {
      setStatus('error')
      setError(e.message)
    }
  }

  async function pollStatus(sandboxId, previewUrl) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const res = await fetch(`/api/sandbox/status/${sandboxId}`)
      const data = await res.json()
      if (data.status === 'ready') {
        navigate(`/dashboard/${sandboxId}`, { state: { previewUrl: data.previewUrl || previewUrl } })
        return
      }
      if (data.status === 'failed') throw new Error(data.reason || 'Sandbox failed to start')
    }
    throw new Error('Sandbox timed out')
  }

  return (
    <div className="relative flex-1 h-full w-full overflow-hidden grid-bg flex flex-col items-center justify-center">
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,58,237,0.15),transparent)] pointer-events-none" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-forge-purple to-forge-indigo flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4l5-3 5 3v8l-5 3-5-3V4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7 1v14M2 4l5 3 5-3" stroke="white" strokeWidth="1" strokeLinejoin="round" opacity="0.6"/>
            </svg>
          </div>
          <span className="font-semibold text-forge-text text-sm tracking-wide">CodeForge</span>
        </div>
        <nav className="flex items-center gap-2">
          <a href="#" className="text-forge-muted text-sm hover:text-forge-text transition-colors px-3 py-2 rounded-lg hover:bg-forge-panel">Docs</a>
          <a href="#" className="text-forge-muted text-sm hover:text-forge-text transition-colors px-3 py-2 rounded-lg hover:bg-forge-panel">Pricing</a>
        </nav>
      </header>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-forge-panel border border-forge-border text-xs text-forge-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-forge-green animate-pulse" />
          AI-Powered Cloud IDE
        </div>

        <h1 className="text-6xl font-bold leading-tight mb-5 tracking-tight">
          <span className="gradient-text">Build with AI</span>
        </h1>
        <p className="text-forge-muted text-lg leading-relaxed mb-10 max-w-md">
          Your intelligent cloud coding environment. Describe what you want, and watch it build in real-time.
        </p>

        {/* CTA */}
        <button
          id="launch-btn"
          onClick={handleLaunch}
          disabled={status === 'loading' || status === 'provisioning'}
          className="relative group px-10 py-5  rounded-2xl font-semibold text-white text-base
            bg-linear-to-r from-forge-purple to-forge-indigo
            hover:from-forge-purple-dim hover:to-forge-indigo-dim
            disabled:opacity-70 disabled:cursor-not-allowed
            transition-all duration-200 glow-purple
            flex items-center gap-3 min-w-55 justify-center shadow-lg"
        >
          {status === 'idle' && (
            <>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                <path d="M5 3l14 9-14 9V3z" fill="white"/>
              </svg>
              Launch Sandbox
            </>
          )}
          {status === 'loading' && (
            <>
              <Spinner />
              Starting...
            </>
          )}
          {status === 'provisioning' && (
            <>
              <Spinner />
              Provisioning sandbox...
            </>
          )}
          {status === 'error' && (
            <>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                <path d="M12 8v4M12 16h.01" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Try Again
            </>
          )}
        </button>

        {error && (
          <p className="mt-4 text-sm text-forge-red bg-forge-panel px-4 py-2 rounded-lg border border-forge-border">
            {error}
          </p>
        )}

        {/* Features */}
        <div className="mt-16 grid grid-cols-3 gap-4 w-full max-w-lg">
          {[
            { icon: '⚡', label: 'Instant Sandbox' },
            { icon: '🤖', label: 'AI Assistant' },
            { icon: '👁', label: 'Live Preview' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-3 p-5 rounded-xl bg-forge-panel border border-forge-border hover:border-forge-purple/40 transition-colors">
              <span className="text-2xl">{icon}</span>
              <span className="text-xs text-forge-muted font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 00-12 12h4z"/>
    </svg>
  )
}
