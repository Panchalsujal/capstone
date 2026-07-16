import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { io } from 'socket.io-client'
import '@xterm/xterm/css/xterm.css'

export default function Terminal({ agentBase, sandboxId }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const socketRef = useRef(null)
  const fitRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Init xterm
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
      theme: {
        background: '#060f16',
        foreground: '#e6edf3',
        cursor: '#7c3aed',
        cursorAccent: '#0d0f14',
        selectionBackground: 'rgba(124,58,237,0.3)',
        black: '#161b22',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#a78bfa',
        cyan: '#34d399',
        white: '#e6edf3',
        brightBlack: '#30363d',
        brightGreen: '#3fb950',
        brightYellow: '#fbbf24',
      },
      scrollback: 1000,
      allowTransparency: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitRef.current = fitAddon

    // Connect socket.io
    const socket = io(agentBase, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      term.writeln('\r\x1b[32m✓\x1b[0m Connected to sandbox terminal')
      term.writeln('\x1b[90m' + agentBase + '\x1b[0m')
      term.writeln('')
    })

    socket.on('output', (data) => {
      term.write(typeof data === 'string' ? data : JSON.stringify(data))
    })

    socket.on('disconnect', () => {
      term.writeln('\r\n\x1b[33m⚠\x1b[0m Terminal disconnected')
    })

    socket.on('connect_error', (err) => {
      term.writeln(`\r\n\x1b[31m✗\x1b[0m Connection error: ${err.message}`)
    })

    // Send user input
    term.onData(data => {
      socket.emit('input', data)
    })

    // Resize observer
    const ro = new ResizeObserver(() => {
      try { fitAddon.fit() } catch (_) {}
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      socket.disconnect()
      term.dispose()
    }
  }, [agentBase])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ padding: '8px', background: '#060f16' }}
    />
  )
}
