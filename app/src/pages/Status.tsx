import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAgents } from '@/lib/useAgents'
import type { AgentStatus } from '@/lib/api'

/* ═══════════════════════════════════════════
   STATUS — live health of hired employees
   Backed entirely by GET /agents. No mock data.
   ═══════════════════════════════════════════ */

const STATUS_META: Record<AgentStatus, { label: string; color: string; pulse: boolean }> = {
  running: { label: 'Running',      color: 'var(--status-active)',  pulse: true  },
  pending: { label: 'Provisioning', color: '#10B981',               pulse: true  },
  stopped: { label: 'Stopped',      color: 'var(--text-tertiary)',  pulse: false },
  error:   { label: 'Error',        color: 'var(--status-error)',   pulse: false },
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
    <div className="dot-grid" style={{ minHeight: '100vh' }}>
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '48px 40px 96px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <div>
            <h1 style={{
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}>
              Workforce
            </h1>
            <p style={{
              marginTop: 6,
              fontSize: 14,
              color: 'var(--text-secondary)',
            }}>
              Health of every AI employee you&rsquo;ve hired.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--text-tertiary)',
              letterSpacing: '0.02em',
            }}>
              {clock}
            </div>
            {!loading && !error && (
              <div style={{
                marginTop: 4,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}>
                <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{runningCount}</span>
                {' '}of {list.length} running
              </div>
            )}
          </div>
        </motion.div>

        {/* Roster */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3 }}
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
          }}
        >
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 160px 120px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface)',
          }}>
            {['Employee', 'Status', 'Hired'].map(h => (
              <span key={h} style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {h}
              </span>
            ))}
          </div>

          {loading && [0, 1].map(i => (
            <div key={`sk-${i}`} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px 120px',
              padding: '16px 20px',
              alignItems: 'center',
              borderBottom: i < 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <div style={{ height: 12, width: 160, background: 'var(--border-default)', borderRadius: 3, opacity: 0.5 }} />
              <div style={{ height: 12, width: 70, background: 'var(--border-default)', borderRadius: 3, opacity: 0.5 }} />
              <div style={{ height: 12, width: 60, background: 'var(--border-default)', borderRadius: 3, opacity: 0.5 }} />
            </div>
          ))}

          {error && (
            <div style={{ padding: '16px 20px' }}>
              <span style={{ fontSize: 13, color: 'var(--status-error)' }}>
                Couldn&rsquo;t load your workforce. {error}
              </span>
            </div>
          )}

          {!loading && !error && list.length === 0 && (
            <div style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                You haven&rsquo;t hired any employees yet.
              </span>
              <Link
                to="/directory"
                style={{
                  fontSize: 13,
                  color: 'var(--accent)',
                  fontWeight: 500,
                }}
              >
                Browse the talent directory →
              </Link>
            </div>
          )}

          {!loading && !error && list.map((agent, i) => {
            const meta = STATUS_META[agent.status]
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.04, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px 120px',
                  padding: '16px 20px',
                  alignItems: 'center',
                  borderBottom: i < list.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                  }}>
                    {agent.role}
                  </div>
                  <div style={{
                    marginTop: 3,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                  }}>
                    {agent.container_id ? agent.container_id.slice(0, 12) : 'no container'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', background: meta.color,
                    ...(meta.pulse ? { animation: 'pulse-status 1.5s ease-in-out infinite' } : {}),
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: meta.color,
                    fontWeight: 500,
                  }}>
                    {meta.label}
                  </span>
                </div>
                <span style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}>
                  {formatHired(agent.created_at)}
                </span>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}
