import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { DockNav } from '@/components/ui/dock-nav'
import { useAgents } from '@/lib/useAgents'
import type { AgentStatus } from '@/lib/api'

/* ═══════════════════════════════════════════
   STATUS — live health of hired employees
   Backed entirely by GET /agents. No mock data.
   ═══════════════════════════════════════════ */

const STATUS_META: Record<AgentStatus, { label: string; color: string; pulse: boolean }> = {
  running: { label: 'RUNNING',      color: 'var(--accent)',       pulse: true  },
  pending: { label: 'PROVISIONING', color: '#00DD77',             pulse: true  },
  stopped: { label: 'STOPPED',      color: 'var(--text-muted)',   pulse: false },
  error:   { label: 'ERROR',        color: 'var(--status-error)', pulse: false },
}

function formatHired(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Status() {
  const [clock, setClock] = useState('')
  const { agents, error, loading } = useAgents()

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  const list = agents ?? []
  const runningCount = list.filter(a => a.status === 'running').length

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
            <span className="font-display" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.15em' }}>
              EMPLOYEE STATUS
            </span>
            <h1 className="font-display" style={{ fontSize: 32, color: 'var(--text-primary)', letterSpacing: '0.04em', marginTop: 8 }}>
              WORKFORCE
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="font-display" style={{ fontSize: 28, color: 'var(--accent)' }}>{clock}</div>
            {!loading && !error && (
              <div className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.08em' }}>
                {runningCount} / {list.length} RUNNING
              </div>
            )}
          </div>
        </motion.div>

        {/* Roster */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-default)',
            overflow: 'hidden',
          }}
        >
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 130px 110px',
            padding: '14px 24px',
            borderBottom: '1px solid var(--border-default)',
          }}>
            {['EMPLOYEE', 'STATUS', 'HIRED'].map(h => (
              <span key={h} className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                {h}
              </span>
            ))}
          </div>

          {loading && [0, 1].map(i => (
            <div key={`sk-${i}`} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 130px 110px',
              padding: '18px 24px',
              alignItems: 'center',
              borderBottom: i < 1 ? '1px solid var(--border-default)' : 'none',
            }}>
              <div style={{ height: 12, width: 160, background: 'var(--border-default)', borderRadius: 3, opacity: 0.4 }} />
              <div style={{ height: 12, width: 70, background: 'var(--border-default)', borderRadius: 3, opacity: 0.4 }} />
              <div style={{ height: 12, width: 60, background: 'var(--border-default)', borderRadius: 3, opacity: 0.4 }} />
            </div>
          ))}

          {error && (
            <div style={{ padding: '18px 24px' }}>
              <span className="font-system" style={{ fontSize: 12, color: 'var(--status-error)' }}>
                Couldn’t load your workforce. {error}
              </span>
            </div>
          )}

          {!loading && !error && list.length === 0 && (
            <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="font-narrative" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                You haven’t hired any employees yet.
              </span>
              <Link
                to="/directory"
                className="font-display"
                style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em' }}
              >
                BROWSE THE TALENT DIRECTORY →
              </Link>
            </div>
          )}

          {!loading && !error && list.map((agent, i) => {
            const meta = STATUS_META[agent.status]
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 110px',
                  padding: '18px 24px',
                  alignItems: 'center',
                  borderBottom: i < list.length - 1 ? '1px solid var(--border-default)' : 'none',
                }}
              >
                <div>
                  <div className="font-display" style={{ fontSize: 13, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>
                    {agent.role}
                  </div>
                  <div className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {agent.container_id ? agent.container_id.slice(0, 12) : 'no container'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', background: meta.color,
                    ...(meta.pulse ? { animation: 'pulse-status 1.5s ease-in-out infinite' } : {}),
                  }} />
                  <span className="font-system" style={{ fontSize: 11, color: meta.color, letterSpacing: '0.06em', fontWeight: 500 }}>
                    {meta.label}
                  </span>
                </div>
                <span className="font-system" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {formatHired(agent.created_at)}
                </span>
              </motion.div>
            )
          })}
        </motion.div>
      </div>

      <DockNav />
    </div>
  )
}
