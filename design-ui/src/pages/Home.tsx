import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DockNav } from '@/components/ui/dock-nav'

const designs = [
  { id: 'agents', label: 'AGNT_00', title: 'Signal Feed',     desc: 'Live agent dashboard — Slack, Gmail, GitHub', primary: true },
  { id: 1,        label: 'CTRL_01', title: 'Mission Control', desc: 'Command center dashboard' },
  { id: 2,        label: 'DPRT_02', title: 'Departure Board', desc: 'Split-flap directory' },
  { id: 3,        label: 'TERM_03', title: 'The Terminal',    desc: 'CRT command interface' },
  { id: 4,        label: 'BCST_04', title: 'Broadcast',       desc: 'TV studio monitor wall' },
  { id: 5,        label: 'SCHM_05', title: 'The Schematic',   desc: 'Circuit blueprint' },
]

export default function Home() {
  const [ready, setReady] = useState(false)
  useEffect(() => { setTimeout(() => setReady(true), 80) }, [])

  return (
    <div className="dot-grid" style={{ minHeight: '100vh', background: 'var(--black)' }}>
      <div style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '120px 32px 160px',
        display: 'flex',
        flexDirection: 'column',
        gap: 64,
        opacity: ready ? 1 : 0,
        transition: 'opacity 400ms ease-out',
      }}>
        {/* Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span className="font-display" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.15em' }}>
            OPENCLAW
          </span>
          <h1 className="font-display" style={{
            fontSize: 'clamp(28px, 5vw, 44px)',
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
            lineHeight: 1.15,
          }}>
            AI EMPLOYEE PLATFORM
          </h1>
          <p className="font-narrative" style={{
            fontSize: 16,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            maxWidth: 440,
          }}>
            Five interface explorations for the retro-futurist signal design language.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {designs.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to={d.id === 'agents' ? '/agents' : `/${d.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 24px',
                  background: (d as {primary?: boolean}).primary ? 'var(--accent-dim)' : 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: (d as {primary?: boolean}).primary ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                  transition: 'border-color 150ms ease-out, background 150ms ease-out',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = (d as {primary?: boolean}).primary ? 'var(--text-primary)' : 'var(--border-hover)'
                  e.currentTarget.style.background = 'var(--surface-raised)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = (d as {primary?: boolean}).primary ? 'var(--accent)' : 'var(--border-default)'
                  e.currentTarget.style.background = (d as {primary?: boolean}).primary ? 'var(--accent-dim)' : 'var(--surface)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <span className="font-display" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.12em', minWidth: 56 }}>
                    {d.label}
                  </span>
                  <div>
                    <div className="font-display" style={{ fontSize: 15, color: 'var(--text-primary)', letterSpacing: '0.04em', marginBottom: 2 }}>
                      {d.title}
                    </div>
                    <div className="font-system" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {d.desc}
                    </div>
                  </div>
                </div>
                <span className="font-system" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  &rarr;
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <DockNav />
    </div>
  )
}
