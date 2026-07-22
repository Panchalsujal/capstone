import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // ── Project list ─────────────────────────────────────────────────────────
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      const res = await fetch('api.brohsop.in/api/sandbox/projects', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setProjects(data.projects)
    } catch { /* silently ignore */ } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // ── Launch flow ──────────────────────────────────────────────────────────
  const [launchStatus, setLaunchStatus] = useState('idle') // idle|creating|starting|provisioning|error
  const [launchError, setLaunchError] = useState('')
  const [projectTitle, setProjectTitle] = useState('')

  async function handleCreate(e) {
    e?.preventDefault()
    if (isBusy) return
    setLaunchStatus('creating')
    setLaunchError('')
    try {
      const title = projectTitle.trim() || 'My Project'
      const createRes = await fetch('/api/sandbox/project', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const createData = await createRes.json()
      if (!createData.success) throw new Error(createData.message || 'Failed to create project')

      setProjectTitle('')
      await launchSandbox(createData.project._id)
      fetchProjects()
    } catch (e) {
      setLaunchStatus('error')
      setLaunchError(e.message)
    }
  }

  async function launchSandbox(projectId) {
    setLaunchStatus('starting')
    const startRes = await fetch('/api/sandbox/start', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
    const startData = await startRes.json()
    if (!startData.success) throw new Error(startData.message || 'Failed to start sandbox')

    if (startData.status === 'ready') {
      navigate(`/dashboard/${startData.sandboxId}`, { state: { previewUrl: startData.previewUrl } })
      return
    }

    setLaunchStatus('provisioning')
    await pollStatus(startData.sandboxId, startData.previewUrl)
  }

  async function handleOpenExisting(projectId) {
    if (isBusy) return
    setLaunchError('')
    try {
      await launchSandbox(projectId)
    } catch (e) {
      setLaunchStatus('error')
      setLaunchError(e.message)
    }
  }

  async function pollStatus(sandboxId, previewUrl) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const res = await fetch(`/api/sandbox/status/${sandboxId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.status === 'ready') {
        navigate(`/dashboard/${sandboxId}`, { state: { previewUrl: data.previewUrl || previewUrl } })
        return
      }
      if (data.status === 'failed') throw new Error(data.reason || 'Sandbox failed to start')
    }
    throw new Error('Sandbox timed out')
  }

  const isBusy = ['creating', 'starting', 'provisioning'].includes(launchStatus)

  function handleLogout() {
    document.cookie = 'token=; Max-Age=0; path=/'
    window.location.href = '/login'
  }

  const statusLabel = {
    creating: 'Creating project…',
    starting: 'Starting sandbox…',
    provisioning: 'Provisioning environment…',
  }[launchStatus]

  return (
    <div className="flex-1 h-full w-full flex flex-col bg-forge-bg overflow-hidden">

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-6 h-14 border-b border-forge-border bg-forge-panel/60 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-linear-to-br from-forge-purple to-forge-indigo flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4l5-3 5 3v8l-5 3-5-3V4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7 1v14M2 4l5 3 5-3" stroke="white" strokeWidth="1" strokeLinejoin="round" opacity="0.6"/>
            </svg>
          </div>
          <span className="font-semibold text-forge-text text-sm tracking-wide">CodeForge</span>
          <span className="text-forge-border mx-1">|</span>
          <span className="text-forge-muted text-xs">Projects</span>
        </div>

        {/* Right side: user info */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {user.avatar
                ? <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full ring-1 ring-forge-border" />
                : <div className="w-7 h-7 rounded-full bg-forge-purple/20 border border-forge-purple/30 flex items-center justify-center text-xs text-forge-purple font-semibold">{user.name?.[0]}</div>
              }
              <span className="text-forge-text text-xs font-medium hidden sm:block">{user.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-forge-muted text-xs hover:text-forge-red transition-colors px-3 py-1.5 rounded-lg hover:bg-forge-card border border-transparent hover:border-forge-border"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel: Create new sandbox */}
        <aside className="w-80 shrink-0 flex flex-col border-r border-forge-border bg-forge-panel/30 p-6 gap-6 overflow-y-auto">

          {/* Greeting */}
          <div>
            <p className="text-forge-muted text-xs mb-1">Welcome back,</p>
            <h1 className="text-forge-text font-semibold text-base">{user?.name?.split(' ')[0] || 'there'} 👋</h1>
          </div>

          {/* Create sandbox form */}
          <div className="flex flex-col gap-1">
            <h2 className="text-forge-text text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" className="text-forge-purple">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              New Sandbox
            </h2>

            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="project-title-input" className="text-forge-muted text-xs">Project name</label>
                <input
                  id="project-title-input"
                  type="text"
                  placeholder="e.g. My React App"
                  value={projectTitle}
                  onChange={e => setProjectTitle(e.target.value)}
                  disabled={isBusy}
                  autoFocus
                  className="w-full bg-forge-card border border-forge-border rounded-xl px-3.5 py-2.5 text-forge-text text-sm
                    placeholder:text-forge-muted/60 outline-none
                    focus:border-forge-purple/60 focus:ring-1 focus:ring-forge-purple/20
                    disabled:opacity-50 transition-all duration-150"
                />
              </div>

              <button
                id="launch-btn"
                type="submit"
                disabled={isBusy}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-white text-sm
                  bg-linear-to-r from-forge-purple to-forge-indigo
                  hover:from-forge-purple-dim hover:to-forge-indigo-dim
                  disabled:opacity-60 disabled:cursor-not-allowed
                  transition-all duration-200 glow-purple shadow-md"
              >
                {isBusy ? (
                  <>
                    <Spinner />
                    {statusLabel}
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                      <path d="M5 3l14 9-14 9V3z" fill="white"/>
                    </svg>
                    Create &amp; Launch
                  </>
                )}
              </button>

              {launchError && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-forge-red/10 border border-forge-red/20 text-forge-red text-xs">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" className="shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  {launchError}
                </div>
              )}
            </form>
          </div>

          {/* Divider */}
          <div className="h-px bg-forge-border" />

          {/* Keyboard hint */}
          <div className="flex flex-col gap-2">
            <p className="text-forge-muted text-xs font-medium">Tip</p>
            <p className="text-forge-muted/70 text-xs leading-relaxed">
              Type a project name and press <kbd className="px-1.5 py-0.5 rounded bg-forge-card border border-forge-border text-forge-text text-[10px] font-mono">Enter</kbd> to instantly launch a sandbox.
            </p>
          </div>

          {/* Stats */}
          <div className="mt-auto glass rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-forge-muted text-xs">Total projects</span>
              <span className="text-forge-text text-sm font-semibold tabular-nums">
                {projectsLoading ? '—' : projects.length}
              </span>
            </div>
          </div>
        </aside>

        {/* Right panel: Projects grid */}
        <main className="flex-1 overflow-y-auto p-6 grid-bg relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_70%_20%,rgba(124,58,237,0.07),transparent)] pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto">
            {/* Header row */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-forge-text font-semibold text-sm">Your Projects</h2>
              <button
                onClick={fetchProjects}
                disabled={projectsLoading}
                className="flex items-center gap-1.5 text-forge-muted text-xs hover:text-forge-text transition-colors disabled:opacity-40"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={projectsLoading ? 'animate-spin' : ''}>
                  <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Refresh
              </button>
            </div>

            {/* Content */}
            {projectsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-28 rounded-xl bg-forge-panel/50 border border-forge-border animate-pulse" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 rounded-2xl border border-dashed border-forge-border bg-forge-panel/20">
                <div className="w-14 h-14 rounded-2xl bg-forge-panel border border-forge-border flex items-center justify-center">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" className="text-forge-muted">
                    <path d="M3 7a2 2 0 012-2h3l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-forge-text text-sm font-medium mb-1">No projects yet</p>
                  <p className="text-forge-muted text-xs">Create your first project using the form on the left.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map(project => (
                  <ProjectCard
                    key={project._id}
                    project={project}
                    onLaunch={() => handleOpenExisting(project._id)}
                    disabled={isBusy}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProjectCard({ project, onLaunch, disabled }) {
  const date = new Date(project.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const time = new Date(project.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="group glass rounded-xl p-5 flex flex-col gap-4 hover:border-forge-purple/40 transition-all duration-200 hover:shadow-lg hover:shadow-forge-purple/5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-forge-purple/10 border border-forge-purple/20 flex items-center justify-center shrink-0">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="text-forge-purple">
            <path d="M3 7a2 2 0 012-2h3l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-forge-text text-sm font-semibold truncate">{project.title}</p>
          <p className="text-forge-muted text-xs mt-0.5">{date} · {time}</p>
        </div>
        {/* Active dot */}
        <div className="w-1.5 h-1.5 rounded-full bg-forge-green mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <button
        onClick={onLaunch}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold
          text-forge-purple border border-forge-purple/25 bg-forge-purple/5
          hover:bg-forge-purple/15 hover:border-forge-purple/50
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-all duration-150 active:scale-[0.98]"
      >
        <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
          <path d="M5 3l14 9-14 9V3z" fill="currentColor"/>
        </svg>
        Open in Sandbox
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 00-12 12h4z"/>
    </svg>
  )
}
