import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DockNav } from '@/components/ui/dock-nav'
import { useRoles } from '@/lib/useRoles'

/* ═══════════════════════════════════════════
   PAGE 2 — DEPARTURE BOARD (Minimal)
   ═══════════════════════════════════════════ */

interface FlightDeco {
  flight: string
  destination: string
  status: string
  statusColor: string
  time: string
}

const flightDecoration: Record<string, FlightDeco> = {
  'code-review-engineer': { flight: 'OC-101', destination: 'GitHub',           status: 'DEPLOYED', statusColor: 'var(--accent)', time: '14:00' },
  'customer-support':     { flight: 'OC-102', destination: 'Slack + Gmail',    status: 'DEPLOYED', statusColor: 'var(--accent)', time: '14:15' },
  'secretary':            { flight: 'OC-103', destination: 'Gmail + Calendar', status: 'BOARDING', statusColor: '#00DD77',       time: '14:30' },
}

export default function Page2() {
  const [clock, setClock] = useState('')
  const { roles, error, loading } = useRoles()

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  const rows = (roles ?? []).map((r, i) => {
    const deco = flightDecoration[r.id]
    return {
      id: r.id,
      flight: deco?.flight ?? `OC-${String(200 + i).padStart(3, '0')}`,
      name: r.display_name,
      destination: deco?.destination ?? (r.required_tools.join(' + ') || '—'),
      status: deco?.status ?? 'ON TIME',
      statusColor: deco?.statusColor ?? 'var(--text-secondary)',
      time: deco?.time ?? '15:00',
    }
  })

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
              DEPARTURE BOARD
            </span>
            <h1 className="font-display" style={{ fontSize: 32, color: 'var(--text-primary)', letterSpacing: '0.04em', marginTop: 8 }}>
              EMPLOYEE DEPARTURES
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="font-display" style={{ fontSize: 32, color: 'var(--accent)' }}>{clock}</div>
            <div className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.08em' }}>LOCAL TIME</div>
          </div>
        </motion.div>

        {/* Board */}
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
            gridTemplateColumns: '72px 1fr 1fr 100px',
            padding: '14px 24px',
            borderBottom: '1px solid var(--border-default)',
          }}>
            {['FLIGHT', 'EMPLOYEE', 'DESTINATION', 'STATUS'].map(h => (
              <span key={h} className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                {h}
              </span>
            ))}
          </div>

          {/* Loading skeletons */}
          {loading && [0, 1, 2].map(i => (
            <div key={`sk-${i}`} style={{
              display: 'grid',
              gridTemplateColumns: '72px 1fr 1fr 100px',
              padding: '18px 24px',
              alignItems: 'center',
              borderBottom: i < 2 ? '1px solid var(--border-default)' : 'none',
            }}>
              <div style={{ height: 12, width: 50, background: 'var(--border-default)', borderRadius: 3, opacity: 0.4 }} />
              <div style={{ height: 12, width: 140, background: 'var(--border-default)', borderRadius: 3, opacity: 0.4 }} />
              <div style={{ height: 12, width: 100, background: 'var(--border-default)', borderRadius: 3, opacity: 0.4 }} />
              <div style={{ height: 12, width: 60, background: 'var(--border-default)', borderRadius: 3, opacity: 0.4 }} />
            </div>
          ))}

          {error && (
            <div style={{ padding: '18px 24px' }}>
              <span className="font-system" style={{ fontSize: 12, color: 'var(--status-error)' }}>
                {error}
              </span>
            </div>
          )}

          {/* Rows */}
          {!loading && !error && rows.map((row, i) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr 1fr 100px',
                padding: '18px 24px',
                alignItems: 'center',
                borderBottom: i < rows.length - 1 ? '1px solid var(--border-default)' : 'none',
              }}
            >
              <span className="font-display" style={{ fontSize: 13, color: 'var(--accent)' }}>{row.flight}</span>
              <div>
                <div className="font-display" style={{ fontSize: 13, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>{row.name}</div>
                <div className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{row.time}</div>
              </div>
              <span className="font-narrative" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.destination}</span>
              <span className="font-system" style={{ fontSize: 11, color: row.statusColor, letterSpacing: '0.06em', fontWeight: 500 }}>
                {row.status}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{ display: 'flex', gap: 24 }}
        >
          {[
            { color: 'var(--accent)', label: 'Deployed' },
            { color: '#00DD77', label: 'Boarding' },
            { color: 'var(--status-error)', label: 'Delayed' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
              <span className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{s.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      <DockNav />
    </div>
  )
}
