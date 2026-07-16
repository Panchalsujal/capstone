import { useState, useRef, useEffect } from 'react'
import Terminal from './Terminal'

export default function Preview({ previewUrl, agentBase, sandboxId }) {
  const iframeRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [key, setKey] = useState(0)
  const [termOpen, setTermOpen] = useState(true)

  function refresh() {
    setLoaded(false)
    setKey(k => k + 1)
  }

  // Split: preview takes ~60%, terminal ~40%
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Preview toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-forge-border bg-forge-card shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-forge-red" />
            <div className="w-3 h-3 rounded-full bg-forge-green" />
            <div className="w-3 h-3 rounded-full bg-forge-purple" />
          </div>
          <code className="text-[10px] font-mono text-forge-muted truncate flex-1 bg-forge-panel px-3 py-1.5 rounded-md ml-1 border border-forge-border/50">
            {previewUrl}
          </code>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <button
            onClick={() => setTermOpen(o => !o)}
            className="p-2 rounded-md text-forge-muted hover:text-forge-text hover:bg-forge-border transition-all"
            title="Toggle Terminal"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 9l4 3-4 3M13 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={refresh}
            className="p-2 rounded-md text-forge-muted hover:text-forge-text hover:bg-forge-border transition-all"
            title="Refresh preview"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-md text-forge-muted hover:text-forge-text hover:bg-forge-border transition-all"
            title="Open in new tab"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>

      {/* iframe */}
      <div className={`relative ${termOpen ? 'h-[55%]' : 'flex-1'} shrink-0 bg-forge-bg`}>
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-forge-bg z-10">
            <div className="w-8 h-8 rounded-xl bg-forge-card border border-forge-border flex items-center justify-center">
              <svg className="animate-spin w-4 h-4 text-forge-purple" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 00-12 12h4z"/>
              </svg>
            </div>
            <p className="text-xs text-forge-muted">Loading preview…</p>
            {/* Skeleton bars */}
            <div className="w-48 space-y-2">
              {[90, 70, 80, 50].map((w, i) => (
                <div key={i} className="h-3 bg-forge-card rounded animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        )}
        <iframe
          key={key}
          ref={iframeRef}
          src={previewUrl}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className="w-full h-full border-none"
          title="Sandbox Preview"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>

      {/* Terminal */}
      {termOpen && (
        <>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-forge-border bg-forge-card shrink-0">
            <div className="flex items-center gap-2">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" className="text-forge-muted" strokeWidth="2"/>
                <path d="M7 9l4 3-4 3M13 15h4" stroke="currentColor" className="text-forge-muted" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-widest text-forge-muted">Terminal</span>
            </div>
            <button
              onClick={() => setTermOpen(false)}
              className="text-forge-muted hover:text-forge-text hover:bg-forge-border transition-colors p-1.5 rounded-md"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="h-[40%] min-h-0 overflow-hidden">
            <Terminal agentBase={agentBase} sandboxId={sandboxId} />
          </div>
        </>
      )}
    </div>
  )
}
