import { useState, useEffect, useCallback } from 'react'

// Convert flat path list to nested tree
function buildTree(paths) {
  const root = {}
  for (const path of paths) {
    const parts = path.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (!node[p]) {
        node[p] = { __isDir: i < parts.length - 1, __children: {}, __path: parts.slice(0, i + 1).join('/') }
      } else if (i < parts.length - 1) {
        node[p].__isDir = true
      }
      node = node[p].__children
    }
  }
  return root
}

// File extension → color
function fileColor(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jsx', 'tsx'].includes(ext)) return '#61dafb'
  if (['css', 'scss'].includes(ext)) return '#a855f7'
  if (['json'].includes(ext)) return '#fbbf24'
  if (['js', 'mjs'].includes(ext)) return '#f59e0b'
  if (['html'].includes(ext)) return '#f97316'
  if (['md'].includes(ext)) return '#6ee7b7'
  if (['ts'].includes(ext)) return '#60a5fa'
  if (['svg', 'png', 'jpg'].includes(ext)) return '#34d399'
  return '#8b949e'
}

// File icon SVG
function FileIcon({ name }) {
  const color = fileColor(name)
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
      <path d="M14 2v6h6" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  )
}

function FolderIcon({ open }) {
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
      <path d={open
        ? "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2h9a2 2 0 012 2v2"
        : "M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"}
        stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round"/>
      {open && <path d="M22 9H2" stroke="#fbbf24" strokeWidth="2"/>}
    </svg>
  )
}

// Recursive tree node component
function TreeNode({ name, node, depth, onFileClick, activePath }) {
  const [open, setOpen] = useState(depth < 2)

  if (node.__isDir) {
    const children = Object.entries(node.__children).sort(([, a], [, b]) => {
      if (a.__isDir && !b.__isDir) return -1
      if (!a.__isDir && b.__isDir) return 1
      return 0
    })

    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ paddingLeft: `${12 + depth * 14}px` }}
          className="flex items-center gap-1.5 w-full py-1 pr-3 hover:bg-forge-card text-forge-muted hover:text-forge-text transition-colors group"
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" className={`transition-transform duration-150 shrink-0 ${open ? 'rotate-90' : ''}`}>
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <FolderIcon open={open} />
          <span className="text-xs truncate">{name}</span>
        </button>
        {open && children.map(([childName, childNode]) => (
          <TreeNode
            key={childName}
            name={childName}
            node={childNode}
            depth={depth + 1}
            onFileClick={onFileClick}
            activePath={activePath}
          />
        ))}
      </div>
    )
  }

  const isActive = activePath === node.__path
  return (
    <button
      onClick={() => onFileClick(node.__path, name)}
      style={{ paddingLeft: `${22 + depth * 14}px` }}
      className={`flex items-center gap-1.5 w-full py-1 pr-3 text-left transition-all
        ${isActive
          ? 'bg-forge-purple/10 border-l-2 border-forge-purple text-forge-text'
          : 'hover:bg-forge-card text-forge-muted hover:text-forge-text border-l-2 border-transparent'}`}
    >
      <FileIcon name={name} />
      <span className="text-xs truncate">{name}</span>
    </button>
  )
}

function CodeViewer({ content, fileName, onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-forge-border bg-forge-card shrink-0">
        <div className="flex items-center gap-2">
          <FileIcon name={fileName} />
          <span className="text-xs font-mono text-forge-text">{fileName}</span>
        </div>
        <button onClick={onClose} className="text-forge-muted hover:text-forge-text transition-colors p-1">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-xs font-mono text-forge-text leading-relaxed whitespace-pre-wrap break-all">
          {content}
        </pre>
      </div>
    </div>
  )
}

export default function FileTree({ agentBase }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFile, setActiveFile] = useState(null) // { path, name, content }
  const [loadingFile, setLoadingFile] = useState(false)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${agentBase}/list-files`)
      const data = await res.json()
      setFiles(data.files || [])
    } catch (e) {
      setError('Could not load files: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [agentBase])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  async function handleFileClick(path, name) {
    if (activeFile?.path === path) { setActiveFile(null); return }
    setLoadingFile(true)
    try {
      const res = await fetch(`${agentBase}/read-files?files=/${path}`)
      const data = await res.json()
      const entry = data.files?.[0]
      const content = entry ? Object.values(entry)[0] : ''
      setActiveFile({ path, name, content })
    } catch (e) {
      setActiveFile({ path, name, content: `Error loading file: ${e.message}` })
    } finally {
      setLoadingFile(false)
    }
  }

  if (activeFile) {
    return <CodeViewer content={activeFile.content} fileName={activeFile.name} onClose={() => setActiveFile(null)} />
  }

  const tree = buildTree(files)
  const treeEntries = Object.entries(tree).sort(([, a], [, b]) => {
    if (a.__isDir && !b.__isDir) return -1
    if (!a.__isDir && b.__isDir) return 1
    return 0
  })

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-forge-border shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-forge-muted">
          Workspace {files.length > 0 && `· ${files.length} files`}
        </span>
        <button
          onClick={fetchFiles}
          disabled={loading}
          className="text-forge-muted hover:text-forge-text transition-colors p-2 rounded-md hover:bg-forge-card disabled:opacity-40"
          title="Refresh"
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" className={loading ? 'animate-spin' : ''}>
            <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && (
          <div className="flex flex-col gap-1.5 p-4">
            {[70, 50, 80, 40, 60].map((w, i) => (
              <div key={i} className="h-4 bg-forge-card rounded animate-pulse" style={{ width: `${w}%`, marginLeft: i > 0 ? '24px' : '0' }} />
            ))}
          </div>
        )}
        {error && (
          <div className="p-4 text-xs text-forge-red">{error}</div>
        )}
        {!loading && !error && treeEntries.map(([name, node]) => (
          <TreeNode
            key={name}
            name={name}
            node={node}
            depth={0}
            onFileClick={handleFileClick}
            activePath={activeFile?.path}
          />
        ))}
        {loadingFile && (
          <div className="absolute inset-0 flex items-center justify-center bg-forge-panel/80 backdrop-blur-sm">
            <svg className="animate-spin w-5 h-5 text-forge-purple" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 00-12 12h4z"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
