import { motion } from 'framer-motion'
import { DockNav } from '@/components/ui/dock-nav'

/* ═══════════════════════════════════════════
   PAGE 5 — THE SCHEMATIC (Minimal)
   Clean circuit blueprint with fewer components,
   more breathing room.
   ═══════════════════════════════════════════ */

interface Chip {
  id: string
  label: string
  sub: string
  x: number
  y: number
  w: number
  h: number
  accent?: boolean
}

const chips: Chip[] = [
  { id: 'U1', label: 'USER CLIENT', sub: 'Next.js / React', x: 80, y: 140, w: 160, h: 80 },
  { id: 'U2', label: 'PLATFORM API', sub: 'FastAPI', x: 360, y: 100, w: 180, h: 160, accent: true },
  { id: 'U3', label: 'DISPATCHER', sub: 'Task Router', x: 660, y: 100, w: 140, h: 64, accent: true },
  { id: 'U4', label: 'AUTH GATEWAY', sub: 'OAuth Proxy', x: 660, y: 196, w: 140, h: 64, accent: true },
  { id: 'U5', label: 'EMP-001', sub: 'Code Review', x: 900, y: 80, w: 130, h: 56 },
  { id: 'U6', label: 'EMP-002', sub: 'Support', x: 900, y: 156, w: 130, h: 56 },
  { id: 'U7', label: 'EMP-003', sub: 'Analyst', x: 900, y: 232, w: 130, h: 56 },
]

const traces: { from: [number, number]; to: [number, number]; active?: boolean }[] = [
  { from: [240, 170], to: [360, 160], active: true },
  { from: [240, 190], to: [360, 220], active: false },
  { from: [540, 150], to: [660, 132], active: true },
  { from: [540, 210], to: [660, 228], active: true },
  { from: [800, 132], to: [900, 108], active: true },
  { from: [800, 132], to: [900, 184], active: true },
  { from: [800, 228], to: [900, 260], active: false },
]

export default function Page5() {
  return (
    <div style={{ minHeight: '100vh', background: '#060610', position: 'relative', overflow: 'hidden' }}>
      {/* Blueprint grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(100,140,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(100,140,255,0.025) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '80px 32px 160px',
        display: 'flex',
        flexDirection: 'column',
        gap: 48,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <span className="font-system" style={{ fontSize: 10, color: 'rgba(100,140,255,0.4)', letterSpacing: '0.15em' }}>
            SYSTEM SCHEMATIC — REV 1.0
          </span>
          <h1 className="font-display" style={{ fontSize: 32, color: 'var(--text-primary)', letterSpacing: '0.04em', marginTop: 8 }}>
            PLATFORM ARCHITECTURE
          </h1>
          <p className="font-narrative" style={{ fontSize: 14, color: 'rgba(100,140,255,0.35)', marginTop: 8, maxWidth: 480 }}>
            Data flows from user client through platform API to containerized employees on the Docker bridge.
          </p>
        </motion.div>

        {/* Schematic SVG */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={{
            background: 'rgba(10,10,20,0.6)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid rgba(100,140,255,0.1)',
            padding: '32px 24px',
            overflow: 'hidden',
          }}
        >
          <svg viewBox="0 0 1100 340" style={{ width: '100%', height: 'auto' }}>
            {/* Traces */}
            {traces.map((t, i) => (
              <motion.line
                key={i}
                x1={t.from[0]} y1={t.from[1]} x2={t.to[0]} y2={t.to[1]}
                stroke={t.active ? 'var(--accent)' : 'rgba(100,140,255,0.15)'}
                strokeWidth={t.active ? 1.5 : 1}
                strokeDasharray={t.active ? 'none' : '5 4'}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
              />
            ))}

            {/* Docker boundary */}
            <rect
              x={875} y={60} width={180} height={250} rx={12}
              fill="none" stroke="rgba(100,140,255,0.1)" strokeWidth={1} strokeDasharray="6 3"
            />
            <text x={885} y={52} fill="rgba(100,140,255,0.25)" fontSize="8" fontFamily="var(--font-system)" letterSpacing="0.08em">
              DOCKER: openclaw-agents
            </text>

            {/* Chips */}
            {chips.map((chip, i) => (
              <motion.g
                key={chip.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
              >
                <rect
                  x={chip.x} y={chip.y} width={chip.w} height={chip.h} rx={8}
                  fill={chip.accent ? 'rgba(255,128,0,0.05)' : 'rgba(255,255,255,0.02)'}
                  stroke={chip.accent ? 'var(--accent)' : 'rgba(100,140,255,0.15)'}
                  strokeWidth={chip.accent ? 1.2 : 0.8}
                />
                <text
                  x={chip.x + 10} y={chip.y + 16}
                  fill="var(--text-muted)" fontSize="8" fontFamily="var(--font-system)" letterSpacing="0.06em"
                >
                  {chip.id}
                </text>
                <text
                  x={chip.x + chip.w / 2} y={chip.y + chip.h / 2 + 1}
                  fill="var(--text-primary)" fontSize="10" fontFamily="var(--font-display)" textAnchor="middle" letterSpacing="0.05em"
                >
                  {chip.label}
                </text>
                <text
                  x={chip.x + chip.w / 2} y={chip.y + chip.h / 2 + 15}
                  fill="var(--text-muted)" fontSize="8" fontFamily="var(--font-narrative)" textAnchor="middle"
                >
                  {chip.sub}
                </text>
              </motion.g>
            ))}
          </svg>
        </motion.div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          style={{ display: 'flex', gap: 28 }}
        >
          {[
            { el: <div style={{ width: 20, height: 0, borderTop: '1.5px solid var(--accent)' }} />, label: 'Active trace' },
            { el: <div style={{ width: 20, height: 0, borderTop: '1px dashed rgba(100,140,255,0.2)' }} />, label: 'Inactive trace' },
            { el: <div style={{ width: 12, height: 8, borderRadius: 3, border: '1px solid var(--accent)', background: 'rgba(255,128,0,0.05)' }} />, label: 'Core' },
            { el: <div style={{ width: 12, height: 8, borderRadius: 3, border: '1px solid rgba(100,140,255,0.15)' }} />, label: 'Service' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {item.el}
              <span className="font-system" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      <DockNav />
    </div>
  )
}
