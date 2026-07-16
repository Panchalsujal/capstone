import { useState } from 'react'
import FileTree from './FileTree'
import Preview from './Preview'

export default function RightPanel({ sandboxId, agentBase, previewUrl }) {
  const [activeTab, setActiveTab] = useState('preview')

  return (
    <div className="w-105 shrink-0 flex flex-col bg-forge-panel h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-forge-border shrink-0">
        {[
          { id: 'files', label: 'Files', icon: (
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          )},
          { id: 'preview', label: 'Preview', icon: (
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M3 9h18" stroke="currentColor" strokeWidth="2"/>
              <circle cx="7" cy="6" r="1" fill="currentColor"/>
              <circle cx="10" cy="6" r="1" fill="currentColor"/>
            </svg>
          )},
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs font-medium transition-all duration-150 border-b-2
              ${activeTab === tab.id
                ? 'border-forge-purple text-forge-text bg-forge-bg/30'
                : 'border-transparent text-forge-muted hover:text-forge-text hover:bg-forge-card'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && (
          <FileTree agentBase={agentBase} />
        )}
        {activeTab === 'preview' && (
          <Preview previewUrl={previewUrl} agentBase={agentBase} sandboxId={sandboxId} />
        )}
      </div>
    </div>
  )
}
