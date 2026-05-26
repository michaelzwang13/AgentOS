import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { signup, login, isLoggedIn, getStoredUser, logout } from '@/lib/api'

type Mode = 'signup' | 'login'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [name, setName]   = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const user = getStoredUser()

  if (isLoggedIn() && user) {
    return (
      <div className="dot-grid" style={{ minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ maxWidth: 460, margin: '0 auto', padding: '120px 32px 96px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Wordmark />
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Welcome back
            </h1>
            <p style={{ marginTop: 6, fontSize: 14, color: 'var(--text-secondary)' }}>
              You&rsquo;re already signed in.
            </p>
          </div>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            padding: 18,
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              {user.name}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {user.email}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-disabled)', marginTop: 10 }}>
              API key {localStorage.getItem('openclaw_api_key')?.slice(0, 12)}…
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/agents')} style={primaryBtn}>
              Open workspace
            </button>
            <button onClick={() => { logout(); window.location.reload() }} style={ghostBtn}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  const passwordValid = password.length >= 8
  const canSubmit = mode === 'signup'
    ? email.trim().length > 0 && name.trim().length > 0 && passwordValid
    : email.trim().length > 0 && passwordValid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      if (mode === 'signup') {
        await signup(email.trim(), name.trim(), password)
      } else {
        await login(email.trim(), password)
      }
      navigate('/agents')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dot-grid" style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '96px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Wordmark />

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {mode === 'signup' ? 'Create your account' : 'Sign in'}
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {mode === 'signup'
              ? 'Hire AI employees and connect them to your tools.'
              : 'Welcome back to AgentOS.'}
          </p>
        </motion.div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border-subtle)' }}>
          {(['signup', 'login'] as Mode[]).map(m => {
            const active = mode === m
            return (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setPassword('') }}
                style={{
                  padding: '10px 16px',
                  marginBottom: -1,
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  transition: 'color 150ms ease, border-color 150ms ease',
                }}
              >
                {m === 'signup' ? 'Sign up' : 'Sign in'}
              </button>
            )
          })}
        </div>

        <motion.form
          key={mode}
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {mode === 'signup' && (
            <Field label="Name">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            {mode === 'signup' && password.length > 0 && !passwordValid && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                Password must be at least 8 characters.
              </p>
            )}
          </Field>
          {error && <p style={{ fontSize: 13, color: 'var(--status-error)' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !canSubmit}
            style={{
              ...primaryBtn,
              marginTop: 8,
              opacity: !loading && canSubmit ? 1 : 0.55,
              cursor: !loading && canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {loading
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : (mode === 'signup' ? 'Get started' : 'Sign in')}
          </button>
        </motion.form>
      </div>
    </div>
  )
}

// ── small composables ────────────────────────────────────────────────────────

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 12px var(--accent-ring)',
        }}
      />
      <span
        className="font-display"
        style={{ fontSize: 20, color: 'var(--text-primary)', letterSpacing: '0.08em' }}
      >
        AgentOS
      </span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block',
        marginBottom: 6,
        fontSize: 13,
        color: 'var(--text-secondary)',
        fontWeight: 500,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 14px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
}

const focusInput = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'var(--accent)'
  e.target.style.boxShadow = '0 0 0 3px var(--accent-ring)'
}
const blurInput = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'var(--border-default)'
  e.target.style.boxShadow = 'none'
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 18px',
  background: 'var(--accent)',
  color: '#000',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  fontWeight: 500,
  transition: 'background 120ms ease',
}

const ghostBtn: React.CSSProperties = {
  padding: '10px 18px',
  background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  fontWeight: 500,
  transition: 'background 120ms ease, border-color 120ms ease',
}
