import { useLocation, useNavigate } from 'react-router-dom'
import { Radio, LayoutGrid, Activity, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getStoredUser, logout } from '@/lib/api'

interface NavItem {
  icon: LucideIcon
  label: string
  path: string
}

const NAV: NavItem[] = [
  { icon: Radio,      label: 'Feed',      path: '/agents'    },
  { icon: LayoutGrid, label: 'Directory', path: '/directory' },
  { icon: Activity,   label: 'Status',    path: '/status'    },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = getStoredUser()

  const handleSignOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 'var(--sidebar-width)',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
      }}
    >
      {/* Wordmark — the one place DotMatrix lives */}
      <div
        style={{
          padding: '24px 20px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 12px var(--accent-ring)',
          }}
        />
        <span
          className="font-display"
          style={{
            fontSize: 18,
            color: 'var(--text-primary)',
            letterSpacing: '0.08em',
          }}
        >
          AgentOS
        </span>
      </div>

      {/* Section label */}
      <div style={{ padding: '0 20px 8px' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--text-disabled)',
            textTransform: 'uppercase',
          }}
        >
          Workspace
        </span>
      </div>

      {/* Nav */}
      <nav style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: active ? 'var(--accent-subtle)' : 'transparent',
                transition: 'background 120ms ease, color 120ms ease',
                fontSize: 14,
                fontWeight: active ? 500 : 400,
                fontFamily: 'var(--font-sans)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--surface-hover)'
                if (!active) e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent'
                if (!active) e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              {/* Active stripe */}
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: -12,
                    top: 8,
                    bottom: 8,
                    width: 2,
                    background: 'var(--accent)',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}
              <Icon
                size={16}
                strokeWidth={1.75}
                style={{ color: active ? 'var(--accent)' : 'currentColor' }}
              />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User pill */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 8px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-primary)',
              flexShrink: 0,
            }}
          >
            {(user?.name ?? user?.email ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.name ?? 'Signed in'}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.email ?? ''}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-tertiary)',
              transition: 'background 120ms ease, color 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-tertiary)'
            }}
          >
            <LogOut size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  )
}

/**
 * Wraps a route so the Sidebar is rendered to the left and the page content
 * takes the remaining horizontal space. Login does NOT use this wrapper —
 * it stays full-bleed.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />
      <main
        style={{
          marginLeft: 'var(--sidebar-width)',
          minHeight: '100vh',
        }}
      >
        {children}
      </main>
    </div>
  )
}
