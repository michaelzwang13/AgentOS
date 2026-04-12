import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DockNav } from '@/components/ui/dock-nav'

/* ═══════════════════════════════════════════
   PAGE 1 — MISSION CONTROL (Minimal)
   ═══════════════════════════════════════════ */

const employees = [
  { id: 'EMP-001', name: 'Code Review Engineer', status: 'active', tasks: 847 },
  { id: 'EMP-002', name: 'Customer Support', status: 'active', tasks: 1263 },
  { id: 'EMP-003', name: 'Data Analyst', status: 'idle', tasks: 156 },
  { id: 'EMP-004', name: 'Security Auditor', status: 'active', tasks: 392 },
]

const recentActivity = [
  { time: '14:33', msg: 'Reviewed PR #1204 on acme/core' },
  { time: '14:31', msg: 'Resolved ticket #TK-8891 via Slack' },
  { time: '14:28', msg: 'CVE scan completed — 0 critical' },
  { time: '14:25', msg: 'Analytics exported to warehouse' },
]

export default function Page1() {
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
        maxWidth: 720,
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
              MISSION CONTROL
            </span>
            <h1 className="font-display" style={{ fontSize: 32, color: 'var(--text-primary)', letterSpacing: '0.04em', marginTop: 8 }}>
              SYSTEM STATUS
            </h1>
          </div>
          <span className="font-display" style={{ fontSize: 28, color: 'var(--text-secondary)' }}>
            {clock}
          </span>
        </motion.div>

        {/* Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          {[
            { label: 'Active', value: '3', unit: '/ 4' },
            { label: 'Tasks Done', value: '2,658', unit: '' },
            { label: 'Uptime', value: '99.97', unit: '%' },
          ].map(m => (
            <div key={m.label} style={{
              padding: 24,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              textAlign: 'center',
            }}>
              <div className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {m.label}
              </div>
              <span className="font-display" style={{ fontSize: 28, color: 'var(--text-primary)' }}>{m.value}</span>
              {m.unit && <span className="font-system" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{m.unit}</span>}
            </div>
          ))}
        </motion.div>

        {/* Employee roster */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-default)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-default)' }}>
            <span className="font-display" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.12em' }}>
              EMPLOYEE ROSTER
            </span>
          </div>
          {employees.map((emp, i) => (
            <div key={emp.id} style={{
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: i < employees.length - 1 ? '1px solid var(--border-default)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: emp.status === 'active' ? 'var(--accent)' : 'var(--status-idle)',
                  ...(emp.status === 'active' ? { animation: 'pulse-status 1.5s ease-in-out infinite' } : {}),
                }} />
                <div>
                  <div className="font-narrative" style={{ fontSize: 14, color: 'var(--text-primary)' }}>{emp.name}</div>
                  <div className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{emp.id}</div>
                </div>
              </div>
              <span className="font-system" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {emp.tasks} tasks
              </span>
            </div>
          ))}
        </motion.div>

        {/* Recent activity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-default)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-default)' }}>
            <span className="font-display" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.12em' }}>
              RECENT ACTIVITY
            </span>
          </div>
          {recentActivity.map((entry, i) => (
            <div key={i} style={{
              padding: '14px 24px',
              display: 'flex',
              gap: 16,
              alignItems: 'baseline',
              borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border-default)' : 'none',
            }}>
              <span className="font-display" style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 40 }}>
                {entry.time}
              </span>
              <span className="font-narrative" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {entry.msg}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      <DockNav />
    </div>
  )
}
