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
          background: 'var(--black)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <div
          style={{
            maxWidth: 440,
            background: 'var(--surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <span className="font-display" style={{ fontSize: 11, color: 'var(--status-error)', letterSpacing: '0.15em' }}>
            SYSTEM FAULT
          </span>
          <h1 className="font-display" style={{ fontSize: 22, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            SOMETHING BROKE
          </h1>
          <p className="font-narrative" style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 1.6 }}>
            An unexpected error stopped this view from rendering. Reloading usually clears it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="font-display"
            style={{
              padding: '12px 24px',
              background: 'var(--accent)',
              color: '#000',
              borderRadius: 'var(--radius-md)',
              fontSize: 11,
              letterSpacing: '0.1em',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            RELOAD
          </button>
        </div>
      </div>
    )
  }
}
