import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DockNav } from '@/components/ui/dock-nav'
import { signup, isLoggedIn, getStoredUser, logout } from '@/lib/api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName]   = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const user = getStoredUser()

  if (isLoggedIn() && user) {
    return (
      <div className="dot-grid" style={{ minHeight: '100vh', background: 'var(--black)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '120px 32px 160px', display: 'flex', flexDirection: 'column', gap: 32 }}>
          <span className="font-display" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.15em' }}>OPENCLAW</span>
          <h1 className="font-display" style={{ fontSize: 28, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            SIGNED IN
          </h1>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', padding: 24 }}>
            <div className="font-narrative" style={{ fontSize: 14, color: '#AAAAAA', marginBottom: 8 }}>
              {user.name} ({user.email})
            </div>
            <div className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              API Key: {localStorage.getItem('openclaw_api_key')?.slice(0, 12)}...
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => navigate('/agents')}
              className="font-display"
              style={{ padding: '12px 24px', background: 'var(--accent)', color: '#000', borderRadius: 'var(--radius-md)', fontSize: 11, letterSpacing: '0.1em' }}
            >
              OPEN AGENT OPS
            </button>
            <button
              onClick={() => { logout(); window.location.reload() }}
              className="font-display"
              style={{ padding: '12px 24px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)' }}
            >
              SIGN OUT
            </button>
          </div>
        </div>
        <DockNav />
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !name.trim()) return
    setLoading(true)
    setError('')
    try {
      await signup(email.trim(), name.trim())
      navigate('/agents')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dot-grid" style={{ minHeight: '100vh', background: 'var(--black)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '120px 32px 160px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <span className="font-display" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.15em' }}>
            OPENCLAW
          </span>
          <h1 className="font-display" style={{ fontSize: 28, color: 'var(--text-primary)', letterSpacing: '0.04em', marginTop: 12 }}>
            SIGN IN
          </h1>
          <p className="font-narrative" style={{ fontSize: 14, color: '#AAAAAA', marginTop: 8, lineHeight: 1.6 }}>
            Create an account to hire AI employees and connect your tools.
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div>
            <label className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>NAME</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="font-narrative"
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)', outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(255,128,0,0.4)')}
              onBlur={e  => (e.target.style.borderColor = 'var(--border-default)')}
            />
          </div>
          <div>
            <label className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="font-narrative"
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)', outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(255,128,0,0.4)')}
              onBlur={e  => (e.target.style.borderColor = 'var(--border-default)')}
            />
          </div>
          {error && <p className="font-system" style={{ fontSize: 12, color: 'var(--status-error)' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !email.trim() || !name.trim()}
            className="font-display"
            style={{
              padding: '14px 24px', marginTop: 8,
              background: !loading && email.trim() && name.trim() ? 'var(--accent)' : 'var(--surface-raised)',
              color: !loading && email.trim() && name.trim() ? '#000' : 'var(--text-muted)',
              borderRadius: 'var(--radius-md)', fontSize: 12, letterSpacing: '0.1em',
              transition: 'all 150ms ease',
            }}
          >
            {loading ? 'CREATING...' : 'GET STARTED'}
          </button>
        </motion.form>
      </div>
      <DockNav />
    </div>
  )
}
