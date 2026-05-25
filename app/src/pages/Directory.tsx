import { motion } from 'framer-motion'
import { useRoles } from '@/lib/useRoles'

/* ═══════════════════════════════════════════
   TALENT DIRECTORY — roles available to hire
   Backed entirely by GET /roles. No mock data.
   ═══════════════════════════════════════════ */

export default function Directory() {
  const { roles, error, loading } = useRoles()
  const list = roles ?? []

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
        >
          <h1 style={{
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}>
            Talent directory
          </h1>
          <p style={{
            marginTop: 6,
            fontSize: 14,
            color: 'var(--text-secondary)',
          }}>
            Browse the roles you can hire. Each employee runs in its own container.
          </p>
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
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Role catalog
            </span>
            {!loading && !error && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-tertiary)',
              }}>
                {list.length} {list.length === 1 ? 'role' : 'roles'}
              </span>
            )}
          </div>

          {loading && [0, 1, 2].map(i => (
            <div key={`sk-${i}`} style={{
              padding: '18px 20px',
              borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ height: 14, width: 200, background: 'var(--border-default)', borderRadius: 3, opacity: 0.5 }} />
              <div style={{ height: 11, width: 320, background: 'var(--border-default)', borderRadius: 3, opacity: 0.3 }} />
            </div>
          ))}

          {error && (
            <div style={{ padding: '18px 20px' }}>
              <span style={{ fontSize: 13, color: 'var(--status-error)' }}>
                Couldn&rsquo;t load the role catalog. {error}
              </span>
            </div>
          )}

          {!loading && !error && list.length === 0 && (
            <div style={{ padding: '18px 20px' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                No roles are published yet.
              </span>
            </div>
          )}

          {!loading && !error && list.map((role, i) => (
            <div key={role.id} style={{
              padding: '20px 20px',
              borderBottom: i < list.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.005em',
                }}>
                  {role.display_name}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                }}>
                  {role.id}
                </span>
              </div>
              {role.description && (
                <p style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                  margin: 0,
                }}>
                  {role.description}
                </p>
              )}
              {role.required_tools.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {role.required_tools.map(tool => (
                    <span key={tool} style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--accent)',
                      background: 'var(--accent-subtle)',
                      borderRadius: 4,
                      padding: '2px 8px',
                      letterSpacing: '0.04em',
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
    </div>
  )
}
