import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DockNav } from '@/components/ui/dock-nav'

/* ═══════════════════════════════════════════
   PAGE 4 — BROADCAST MONITOR (Minimal)
   ═══════════════════════════════════════════ */

interface Channel {
  number: string
  name: string
  status: 'on-air' | 'standby' | 'offline'
  task: string
  signal: number
}

const channels: Channel[] = [
  { number: 'CH.01', name: 'Code Review Engineer', status: 'on-air', task: 'Reviewing PR #1204', signal: 5 },
  { number: 'CH.02', name: 'Customer Support', status: 'on-air', task: 'Handling ticket #TK-8891', signal: 4 },
  { number: 'CH.03', name: 'Data Analyst', status: 'standby', task: 'Idle — awaiting task', signal: 3 },
  { number: 'CH.04', name: 'Security Auditor', status: 'on-air', task: 'Scanning for CVEs', signal: 5 },
]

function SignalBars({ level }: { level: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: 3, height: 2 + i * 2, borderRadius: 1,
          background: i <= level ? 'var(--accent)' : 'var(--border-default)',
        }} />
      ))}
    </div>
  )
}

export default function Page4() {
  const [selected, setSelected] = useState(0)
  const [clock, setClock] = useState('')

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="dot-grid" style={{ minHeight: '100vh', background: 'var(--black)' }}>
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '80px 32px 160px',
        display: 'flex',
        flexDirection: 'column',
        gap: 48,
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-error)', animation: 'pulse-status 1s ease-in-out infinite' }} />
              <span className="font-display" style={{ fontSize: 10, color: 'var(--status-error)', letterSpacing: '0.15em' }}>
                LIVE
              </span>
            </div>
            <h1 className="font-display" style={{ fontSize: 32, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              BROADCAST CENTER
            </h1>
          </div>
          <span className="font-display" style={{ fontSize: 20, color: 'var(--text-secondary)' }}>{clock}</span>
        </motion.div>

        {/* Monitor grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {channels.map((ch, i) => (
            <motion.div
              key={ch.number}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setSelected(i)}
              style={{
                background: selected === i ? 'var(--surface-raised)' : 'var(--surface)',
                borderRadius: 'var(--radius-lg)',
                border: selected === i ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                padding: 24,
                cursor: 'pointer',
                transition: 'border-color 120ms ease-out, background 120ms ease-out',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Channel header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="font-display" style={{ fontSize: 13, color: ch.status === 'on-air' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {ch.number}
                  </span>
                  {ch.status === 'on-air' && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'rgba(255,68,68,0.15)', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--status-error)', animation: 'pulse-status 1s ease-in-out infinite' }} />
                      <span className="font-system" style={{ fontSize: 8, color: 'var(--status-error)', letterSpacing: '0.1em', fontWeight: 600 }}>ON AIR</span>
                    </span>
                  )}
                </div>
                <SignalBars level={ch.signal} />
              </div>

              {/* Content */}
              <div>
                <div className="font-display" style={{ fontSize: 14, color: 'var(--text-primary)', letterSpacing: '0.03em', marginBottom: 4 }}>
                  {ch.name}
                </div>
                <div className="font-narrative" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {ch.task}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Selected detail */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-default)',
            padding: 28,
          }}
        >
          <div className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 12 }}>
            SELECTED CHANNEL
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
            <span className="font-display" style={{ fontSize: 24, color: 'var(--accent)' }}>
              {channels[selected].number}
            </span>
            <span className="font-display" style={{ fontSize: 16, color: 'var(--text-primary)' }}>
              {channels[selected].name}
            </span>
          </div>
          <p className="font-narrative" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {channels[selected].task}. Each channel is a live feed from a containerized
            employee. Signal strength reflects gateway connectivity.
          </p>
        </motion.div>
      </div>

      <DockNav />
    </div>
  )
}
