import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Root error boundary — catches render-time crashes so a single bad component
 * doesn't blank the whole app. Shows a recoverable fallback in the app's visual
 * language.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surfaced in the console for debugging; wire to a logging service in prod.
    console.error('Uncaught render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        className="dot-grid"
        style={{
          minHeight: '100vh',
          background: 'var(--background)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--status-error)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            System fault
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Something broke
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            An unexpected error stopped this view from rendering. Reloading usually clears it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              alignSelf: 'flex-start',
              padding: '10px 18px',
              background: 'var(--accent)',
              color: '#000',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
