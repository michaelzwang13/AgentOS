import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DockNav } from '@/components/ui/dock-nav'
import { useRoles } from '@/lib/useRoles'

/* ═══════════════════════════════════════════
   TALENT DIRECTORY — roles available to hire
   Backed entirely by GET /roles. No mock data.
   ═══════════════════════════════════════════ */

export default function Directory() {
  const [clock, setClock] = useState('')
  const { roles, error, loading } = useRoles()

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  const list = roles ?? []

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
              TALENT DIRECTORY
            </span>
            <h1 className="font-display" style={{ fontSize: 32, color: 'var(--text-primary)', letterSpacing: '0.04em', marginTop: 8 }}>
              AVAILABLE ROLES
            </h1>
          </div>
          <span className="font-display" style={{ fontSize: 28, color: 'var(--text-secondary)' }}>
            {clock}
          </span>
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
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span className="font-display" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.12em' }}>
              ROLE CATALOG
            </span>
            {!loading && !error && (
              <span className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                {list.length} {list.length === 1 ? 'ROLE' : 'ROLES'}
              </span>
            )}
          </div>

          {loading && [0, 1, 2].map(i => (
            <div key={`sk-${i}`} style={{
              padding: '20px 24px',
              borderBottom: i < 2 ? '1px solid var(--border-default)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ height: 14, width: 200, background: 'var(--border-default)', borderRadius: 3, opacity: 0.4 }} />
              <div style={{ height: 11, width: 320, background: 'var(--border-default)', borderRadius: 3, opacity: 0.25 }} />
            </div>
          ))}

          {error && (
            <div style={{ padding: '20px 24px' }}>
              <span className="font-system" style={{ fontSize: 12, color: 'var(--status-error)' }}>
                Couldn’t load the role catalog. {error}
              </span>
            </div>
          )}

          {!loading && !error && list.length === 0 && (
            <div style={{ padding: '20px 24px' }}>
              <span className="font-narrative" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                No roles are published yet.
              </span>
            </div>
          )}

          {!loading && !error && list.map((role, i) => (
            <div key={role.id} style={{
              padding: '20px 24px',
              borderBottom: i < list.length - 1 ? '1px solid var(--border-default)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span className="font-display" style={{ fontSize: 15, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>
                  {role.display_name}
                </span>
                <span className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {role.id}
                </span>
              </div>
              {role.description && (
                <p className="font-narrative" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {role.description}
                </p>
              )}
              {role.required_tools.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {role.required_tools.map(tool => (
                    <span key={tool} className="font-system" style={{
                      fontSize: 9,
                      color: 'var(--accent)',
                      background: 'var(--accent-dim)',
                      borderRadius: 4,
                      padding: '2px 8px',
                      letterSpacing: '0.06em',
                    }}>
                      {tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </div>

      <DockNav />
    </div>
  )
}
