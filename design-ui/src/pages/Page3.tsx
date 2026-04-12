import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { DockNav } from '@/components/ui/dock-nav'

/* ═══════════════════════════════════════════
   PAGE 3 — THE TERMINAL (Minimal)
   ═══════════════════════════════════════════ */

interface OutputLine {
  text: string
  type: 'system' | 'command' | 'output' | 'success' | 'accent' | 'ascii'
  delay: number
}

const bootSequence: OutputLine[] = [
  { text: '', type: 'system', delay: 0 },
  { text: '  ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗    ██╗', type: 'ascii', delay: 100 },
  { text: ' ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║    ██║', type: 'ascii', delay: 120 },
  { text: ' ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║     ███████║██║ █╗ ██║', type: 'ascii', delay: 140 },
  { text: ' ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║██║███╗██║', type: 'ascii', delay: 160 },
  { text: ' ╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗███████╗██╔══██║╚███╔███╔╝', type: 'ascii', delay: 180 },
  { text: '  ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ', type: 'ascii', delay: 200 },
  { text: '', type: 'system', delay: 250 },
  { text: ' AI Employee Platform v1.0.0', type: 'system', delay: 400 },
  { text: '', type: 'system', delay: 450 },
  { text: ' [BOOT] Docker bridge: openclaw-agents ........... OK', type: 'system', delay: 600 },
  { text: ' [BOOT] Credential vault ........................ OK', type: 'system', delay: 800 },
  { text: ' [BOOT] OAuth gateway ........................... OK', type: 'system', delay: 1000 },
  { text: ' [BOOT] Task dispatcher ......................... OK', type: 'success', delay: 1200 },
  { text: '', type: 'system', delay: 1350 },
  { text: ' $ openclaw status', type: 'command', delay: 1700 },
  { text: '', type: 'system', delay: 1900 },
  { text: '   EMP-001  Code Review Engineer    active    847 tasks', type: 'accent', delay: 2000 },
  { text: '   EMP-002  Customer Support        active   1263 tasks', type: 'accent', delay: 2060 },
  { text: '   EMP-003  Data Analyst            idle      156 tasks', type: 'output', delay: 2120 },
  { text: '   EMP-004  Security Auditor        active    392 tasks', type: 'accent', delay: 2180 },
  { text: '', type: 'system', delay: 2300 },
  { text: ' $ openclaw hire --role "frontend-engineer" --tier operator', type: 'command', delay: 2700 },
  { text: '', type: 'system', delay: 2900 },
  { text: ' [HIRE] Provisioning container EMP-005...', type: 'system', delay: 3000 },
  { text: ' [HIRE] FastAPI runtime started on :8080', type: 'system', delay: 3300 },
  { text: ' [  OK  ] Employee hired successfully', type: 'success', delay: 3600 },
  { text: '', type: 'system', delay: 3700 },
  { text: ' $ _', type: 'command', delay: 4100 },
]

const typeColors: Record<string, string> = {
  system: 'var(--text-muted)',
  command: 'var(--text-primary)',
  output: 'var(--text-secondary)',
  success: '#00DD77',
  accent: 'var(--accent)',
  ascii: 'var(--accent)',
}

export default function Page3() {
  const [lines, setLines] = useState<OutputLine[]>([])
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = []
    bootSequence.forEach((line) => {
      const t = setTimeout(() => setLines(prev => [...prev, line]), line.delay + 400)
      timeouts.push(t)
    })
    return () => timeouts.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [lines])

  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px 120px' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,220,120,0.02) 0%, transparent 60%)', pointerEvents: 'none' }} />

      {/* CRT frame */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%',
          maxWidth: 740,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-default)',
          overflow: 'hidden',
        }}
      >
        {/* Top bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840' }} />
            </div>
            <span className="font-system" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>openclaw-terminal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00DD77' }} />
            <span className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)' }}>connected</span>
          </div>
        </div>

        {/* Terminal screen */}
        <div
          ref={terminalRef}
          style={{
            height: 'min(60vh, 520px)',
            overflowY: 'auto',
            padding: '20px 24px',
            background: '#0a0a0a',
            position: 'relative',
          }}
        >
          {/* Subtle scanlines */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.01) 3px, rgba(255,255,255,0.01) 4px)',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {lines.map((line, i) => (
              <div key={i} style={{
                fontFamily: 'var(--font-system)',
                fontSize: line.type === 'ascii' ? 10 : 13,
                color: typeColors[line.type],
                lineHeight: line.type === 'ascii' ? 1.15 : 1.65,
                whiteSpace: 'pre',
                textShadow: line.type === 'success' ? '0 0 6px rgba(0,220,120,0.2)' : 'none',
                fontWeight: line.type === 'command' ? 600 : 400,
                minHeight: line.text === '' ? 18 : 'auto',
              }}>
                {line.text}
                {i === lines.length - 1 && line.type === 'command' && line.text.endsWith('_') && (
                  <span style={{
                    display: 'inline-block', width: 8, height: 15,
                    background: '#00DD77', marginLeft: -8,
                    animation: 'blink 1s step-end infinite',
                    verticalAlign: 'text-bottom', borderRadius: 1,
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.5 }}
        className="font-narrative"
        style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 32, textAlign: 'center', maxWidth: 400 }}
      >
        The terminal is the truth layer — what the GUI abstracts, the CLI makes explicit.
      </motion.p>

      <DockNav />
    </div>
  )
}
