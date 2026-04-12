import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DockNav } from '@/components/ui/dock-nav'

/* ═══════════════════════════════════════════
   PAGE 2 — DEPARTURE BOARD (Minimal)
   ═══════════════════════════════════════════ */

const rows = [
  { id: 'OC-101', name: 'Code Review Engineer', destination: 'GitHub', status: 'DEPLOYED', statusColor: 'var(--accent)', time: '14:00' },
  { id: 'OC-102', name: 'Customer Support', destination: 'Slack + Gmail', status: 'DEPLOYED', statusColor: 'var(--accent)', time: '14:15' },
  { id: 'OC-103', name: 'Data Analyst', destination: 'Warehouse', status: 'BOARDING', statusColor: '#00DD77', time: '14:30' },
  { id: 'OC-104', name: 'Security Auditor', destination: 'CVE Database', status: 'ON TIME', statusColor: 'var(--text-secondary)', time: '15:00' },
  { id: 'OC-105', name: 'Technical Writer', destination: 'Confluence', status: 'DELAYED', statusColor: 'var(--status-error)', time: '15:15' },
]

export default function Page2() {
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

          {/* Rows */}
          {rows.map((row, i) => (
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
              <span className="font-display" style={{ fontSize: 13, color: 'var(--accent)' }}>{row.id}</span>
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
