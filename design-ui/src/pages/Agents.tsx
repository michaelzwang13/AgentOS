import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DockNav } from '@/components/ui/dock-nav'
import {
  isLoggedIn,
  fetchSlackMessages,
  fetchGmailMessages,
  fetchGithubActivity,
  disconnectService,
  oauthUrl,
  streamChat,
} from '@/lib/api'

/* ═══════════════════════════════════════════
   AGENTS — Signal Feed + Query (Live)
   ═══════════════════════════════════════════ */

// ── Types ──────────────────────────────────
interface SlackMessage {
  id: string; user: string; text: string; channel: string; time: string; priority: string; read: boolean;
}
interface Email {
  id: string; from: string; subject: string; body: string; time: string; priority: string; read: boolean; labels: string[];
}
interface GithubItem {
  id: string; repo: string; title: string; type: string; reason: string; time: string; unread: boolean; author?: string; state?: string;
}
interface ChatMsg { role: 'user' | 'assistant'; content: string }
type Tab = 'slack' | 'gmail' | 'github'

// ── Mock data (fallback) ───────────────────
const MOCK_SLACK: SlackMessage[] = [
  { id: 's1', user: 'Sarah Chen',    text: 'Blocked on pricing page copy — marketing hasn\'t signed off. Can you get Alex to approve by EOD?', channel: 'launch',  time: '9:14 AM',   priority: 'high',   read: false },
  { id: 's2', user: 'Marcus Rivera', text: 'Pushed the hotfix. Monitoring now.',                                                                channel: 'on-call', time: '8:52 AM',   priority: 'high',   read: false },
  { id: 's3', user: 'Dev Bot',       text: 'PR #142 \'feat: redesign checkout flow\' opened by jdoe. Awaiting review. +287 −41.',              channel: 'github',  time: '8:31 AM',   priority: 'medium', read: true  },
  { id: 's4', user: 'Priya Nair',    text: 'Q2 All Hands Thursday 2pm. Slides due Wednesday EOD.',                                             channel: 'general', time: 'Yesterday', priority: 'low',    read: true  },
]

const MOCK_GMAIL: Email[] = [
  { id: 'e1', from: 'Sarah Chen',    subject: 'Re: Q2 launch — need decision by EOD',  body: 'We\'re blocked on pricing page copy. Can you get Alex to approve?',         time: '9:14 AM',   priority: 'high',   read: false, labels: ['launch', 'urgent'] },
  { id: 'e2', from: 'Marcus Rivera', subject: 'Contract renewal — 30 day notice',       body: 'Your contract expires May 12th. 5% discount for early renewal before Apr 25.', time: '8:47 AM',   priority: 'high',   read: false, labels: ['legal'] },
  { id: 'e3', from: 'Dev Bot',       subject: '[acme/frontend] PR #142 needs review',   body: 'PR #142 opened by jdoe, awaiting your review. 3 files changed.',            time: 'Yesterday', priority: 'medium', read: true,  labels: ['github'] },
  { id: 'e4', from: 'Priya Nair',    subject: 'Budget approval for new tooling',        body: 'Submitted tooling budget request ($12k). Finance needs sign-off Apr 20.',   time: 'Mon',       priority: 'low',    read: true,  labels: ['budget'] },
]

const MOCK_GITHUB: GithubItem[] = [
  { id: 'g1', repo: 'acme/frontend', title: 'feat: redesign checkout flow',           type: 'PR',    reason: 'review requested', time: '2h ago',    unread: true,  author: 'jdoe',     state: 'open'  },
  { id: 'g2', repo: 'acme/backend',  title: 'fix: race condition in session handler', type: 'PR',    reason: 'review requested', time: '4h ago',    unread: true,  author: 'priya-n',  state: 'open'  },
  { id: 'g3', repo: 'acme/frontend', title: 'CI failing on main — lint error',        type: 'Issue', reason: 'mentioned',        time: '5h ago',    unread: true                                      },
  { id: 'g4', repo: 'acme/infra',    title: 'chore: bump node to 22 LTS',            type: 'PR',    reason: 'subscribed',       time: 'Yesterday', unread: false, author: 'marcus-r', state: 'draft' },
]

const SUGGESTED: Record<Tab, string[]> = {
  slack:  ['What needs my attention right now?', 'Any blockers I should unblock?', 'Summarize the most urgent messages'],
  gmail:  ['What requires a response today?',    'Any deadlines I\'m missing?',    'Draft a reply to the most urgent email'],
  github: ['Which PRs need my review?',          'Any CI failures blocking deploys?', 'Summarize open review requests'],
}

function buildContext(tab: Tab, slack: SlackMessage[], gmail: Email[], github: GithubItem[]) {
  if (tab === 'slack')  return slack.map(m  => `[#${m.channel}] ${m.user}: ${m.text} (${m.time})`).join('\n')
  if (tab === 'gmail')  return gmail.map(e  => `From: ${e.from} | ${e.subject} | ${e.body} (${e.time})`).join('\n')
  return github.map(i => `[${i.type}] ${i.repo}: ${i.title} — ${i.reason} (${i.time})`).join('\n')
}

// ── Component ───────────────────────────────
export default function Agents() {
  const [tab, setTab]     = useState<Tab>('slack')
  const [clock, setClock] = useState('')

  // Connection states
  const [slackConn,  setSlackConn]  = useState(false)
  const [gmailConn,  setGmailConn]  = useState(false)
  const [githubConn, setGithubConn] = useState(false)

  // Data states
  const [slackData,  setSlackData]  = useState<SlackMessage[]>(MOCK_SLACK)
  const [gmailData,  setGmailData]  = useState<Email[]>(MOCK_GMAIL)
  const [githubData, setGithubData] = useState<GithubItem[]>(MOCK_GITHUB)
  const [feedLoading, setFeedLoading] = useState(true)

  // Chat states
  const [messages,  setMessages]  = useState<ChatMsg[]>([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  // clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  // Fetch live feeds on mount
  useEffect(() => {
    if (!isLoggedIn()) {
      setFeedLoading(false)
      return
    }
    Promise.allSettled([
      fetchSlackMessages().then(d => {
        if (d.connected && d.messages?.length) { setSlackConn(true); setSlackData(d.messages) }
      }),
      fetchGmailMessages().then(d => {
        if (d.connected && d.emails?.length) { setGmailConn(true); setGmailData(d.emails) }
      }),
      fetchGithubActivity().then(d => {
        if (d.connected && d.items?.length) { setGithubConn(true); setGithubData(d.items) }
      }),
    ]).finally(() => setFeedLoading(false))
  }, [])

  // Handle OAuth redirect params
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('connected') === 'true' || p.get('connected') === 'slack') {
      fetchSlackMessages().then(d => { if (d.connected) { setSlackConn(true); setSlackData(d.messages) } })
    }
    if (p.get('gmail_connected')) {
      fetchGmailMessages().then(d => { if (d.connected) { setGmailConn(true); setGmailData(d.emails) } })
    }
    if (p.get('github_connected')) {
      fetchGithubActivity().then(d => { if (d.connected) { setGithubConn(true); setGithubData(d.items) } })
    }
    if (p.toString()) window.history.replaceState({}, '', '/agents')
  }, [])

  // reset chat on tab switch
  useEffect(() => { setMessages([]); setInput('') }, [tab])

  // scroll to bottom
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const connected = tab === 'slack' ? slackConn : tab === 'gmail' ? gmailConn : githubConn
  const feedData = tab === 'slack' ? slackData : tab === 'gmail' ? gmailData : githubData
  const unreadCount = (items: typeof feedData) => items.filter(i => 'read' in i ? !i.read : (i as GithubItem).unread).length

  const connectHref = oauthUrl(tab)

  const getContext = useCallback(
    () => buildContext(tab, slackData, gmailData, githubData),
    [tab, slackData, gmailData, githubData]
  )

  async function handleDisconnect() {
    await disconnectService(tab as 'slack' | 'gmail' | 'github')
    if (tab === 'slack')  { setSlackConn(false);  setSlackData(MOCK_SLACK)   }
    if (tab === 'gmail')  { setGmailConn(false);  setGmailData(MOCK_GMAIL)   }
    if (tab === 'github') { setGithubConn(false); setGithubData(MOCK_GITHUB) }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || streaming) return
    const text = input.trim()
    setInput('')
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setStreaming(true)
    setMessages(m => [...m, { role: 'assistant', content: '' }])
    try {
      await streamChat(
        tab,
        getContext(),
        next.map(m => ({ role: m.role, content: m.content })),
        (full) => setMessages(m => { const u = [...m]; u[u.length - 1] = { role: 'assistant', content: full }; return u }),
      )
    } catch (err) {
      setMessages(m => { const u = [...m]; u[u.length - 1] = { role: 'assistant', content: `Error: ${err}` }; return u })
    } finally {
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'slack',  label: 'SLACK'  },
    { id: 'gmail',  label: 'GMAIL'  },
    { id: 'github', label: 'GITHUB' },
  ]

  return (
    <div className="dot-grid" style={{ minHeight: '100vh', background: 'var(--black)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 40px 160px', display: 'flex', flexDirection: 'column', gap: 48 }}>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="font-display" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.15em' }}>
                OPENCLAW / AGENT OPS
              </span>
              {/* connection dots */}
              <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
                {[
                  { code: 'SLK', live: slackConn },
                  { code: 'GML', live: gmailConn },
                  { code: 'GHB', live: githubConn },
                ].map(({ code, live }) => (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: live ? 'var(--accent)' : 'var(--status-idle)', animation: live ? 'pulse-status 1.5s ease-in-out infinite' : 'none' }} />
                    <span className="font-system" style={{ fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{code}</span>
                  </div>
                ))}
              </div>
            </div>
            <h1 className="font-display" style={{ fontSize: 38, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1.1 }}>
              SIGNAL FEED
            </h1>
            <p className="font-narrative" style={{ fontSize: 15, color: '#AAAAAA', maxWidth: 420, lineHeight: 1.65 }}>
              Live streams from your connected tools. Query each agent inline.
            </p>
          </div>
          <span className="font-display" style={{ fontSize: 32, color: '#555555' }}>{clock}</span>
        </motion.div>

        {/* ── Tab strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', gap: 0 }}
        >
          {TABS.map(t => {
            const data = t.id === 'slack' ? slackData : t.id === 'gmail' ? gmailData : githubData
            const n = unreadCount(data)
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: 'none',
                  padding: '10px 22px',
                  marginBottom: -1,
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'color 150ms ease',
                }}
                className="font-display"
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <span style={{ fontSize: 13, letterSpacing: '0.12em' }}>{t.label}</span>
                {n > 0 && (
                  <span className="font-system" style={{ fontSize: 9, background: 'var(--accent)', color: '#000', borderRadius: 'var(--radius-pill)', padding: '1px 6px', fontWeight: 700 }}>
                    {n}
                  </span>
                )}
              </button>
            )
          })}
        </motion.div>

        {/* ── Two-column layout ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >

            {/* ── Feed panel ── */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 600 }}>
              {/* header */}
              <div style={{ padding: '18px 28px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span className="font-display" style={{ fontSize: 12, color: 'var(--accent)', letterSpacing: '0.12em' }}>
                  {tab.toUpperCase()} FEED
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--accent)' : 'var(--status-idle)', animation: connected ? 'pulse-status 1.5s ease-in-out infinite' : 'none' }} />
                    <span className="font-system" style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em' }}>
                      {connected ? 'LIVE' : 'DEMO'}
                    </span>
                  </div>
                  {!connected ? (
                    <a
                      href={connectHref}
                      className="font-display"
                      style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.1em', padding: '4px 12px', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', transition: 'background 150ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      CONNECT
                    </a>
                  ) : (
                    <button
                      onClick={handleDisconnect}
                      className="font-system"
                      style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}
                    >
                      DISCONNECT
                    </button>
                  )}
                </div>
              </div>

              {/* items */}
              {feedLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[0, 150, 300].map(d => (
                      <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', animation: `pulse-status 1.2s ease-in-out ${d}ms infinite` }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {tab === 'slack' && slackData.map((msg, i) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      style={{ padding: '18px 28px', borderBottom: '1px solid var(--surface-raised)', borderLeft: !msg.read ? '2px solid var(--accent)' : '2px solid transparent', transition: 'background 120ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="font-display" style={{ fontSize: 13, color: !msg.read ? 'var(--text-primary)' : '#AAAAAA' }}>{msg.user}</span>
                          <span className="font-system" style={{ fontSize: 9, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 4, padding: '2px 7px', letterSpacing: '0.06em' }}>#{msg.channel}</span>
                          {msg.priority === 'high' && <span className="font-system" style={{ fontSize: 9, color: 'var(--status-error)', letterSpacing: '0.1em' }}>URGENT</span>}
                        </div>
                        <span className="font-system" style={{ fontSize: 10, color: '#666' }}>{msg.time}</span>
                      </div>
                      <p className="font-narrative" style={{ margin: 0, fontSize: 14, color: '#AAAAAA', lineHeight: 1.65 }}>{msg.text}</p>
                    </motion.div>
                  ))}

                  {tab === 'gmail' && gmailData.map((email, i) => (
                    <motion.div
                      key={email.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-raised)', borderLeft: !email.read ? '2px solid var(--accent)' : '2px solid transparent', transition: 'background 120ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="font-display" style={{ fontSize: 13, color: !email.read ? 'var(--text-primary)' : '#AAAAAA' }}>{email.from}</span>
                          {email.priority === 'high' && <span className="font-system" style={{ fontSize: 9, color: 'var(--status-error)', letterSpacing: '0.1em' }}>URGENT</span>}
                        </div>
                        <span className="font-system" style={{ fontSize: 10, color: '#666' }}>{email.time}</span>
                      </div>
                      <p className="font-display" style={{ margin: '0 0 5px', fontSize: 12, color: !email.read ? 'var(--text-primary)' : '#AAAAAA', letterSpacing: '0.03em' }}>{email.subject}</p>
                      <p className="font-narrative" style={{ margin: '0 0 10px', fontSize: 13, color: '#777', lineHeight: 1.6 }}>{email.body}</p>
                      {email.labels.length > 0 && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          {email.labels.map(l => (
                            <span key={l} className="font-system" style={{ fontSize: 9, color: '#666', background: 'var(--surface-raised)', border: '1px solid var(--border-default)', borderRadius: 4, padding: '2px 7px' }}>{l}</span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {tab === 'github' && githubData.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-raised)', borderLeft: item.unread ? '2px solid var(--accent)' : '2px solid transparent', transition: 'background 120ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="font-system" style={{ fontSize: 9, color: item.type === 'PR' ? '#00DD77' : '#AAAAAA', border: `1px solid ${item.type === 'PR' ? '#00DD77' : 'var(--border-default)'}`, borderRadius: 4, padding: '2px 6px', letterSpacing: '0.06em' }}>{item.type}</span>
                          <span className="font-system" style={{ fontSize: 10, color: 'var(--accent)' }}>{item.repo}</span>
                          {item.state === 'draft' && <span className="font-system" style={{ fontSize: 9, color: '#555', letterSpacing: '0.08em' }}>DRAFT</span>}
                        </div>
                        <span className="font-system" style={{ fontSize: 10, color: '#666' }}>{item.time}</span>
                      </div>
                      <p className="font-narrative" style={{ margin: '0 0 7px', fontSize: 14, color: item.unread ? 'var(--text-primary)' : '#AAAAAA', lineHeight: 1.55 }}>{item.title}</p>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <span className="font-system" style={{ fontSize: 10, color: '#666' }}>{item.reason}</span>
                        {item.author && <span className="font-system" style={{ fontSize: 10, color: '#666' }}>@{item.author}</span>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Query panel ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', height: 600 }}
            >
              {/* header */}
              <div style={{ padding: '18px 28px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                <span className="font-display" style={{ fontSize: 12, color: 'var(--accent)', letterSpacing: '0.12em' }}>
                  QUERY / {tab.toUpperCase()} AGENT
                </span>
              </div>

              {/* messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                  >
                    <span className="font-system" style={{ fontSize: 10, color: '#555', letterSpacing: '0.12em' }}>SUGGESTED QUERIES</span>
                    {SUGGESTED[tab].map((q, i) => (
                      <motion.button
                        key={q}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.06, duration: 0.3 }}
                        onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50) }}
                        style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'left', transition: 'border-color 150ms ease, color 150ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = '#AAAAAA' }}
                      >
                        <span className="font-narrative" style={{ fontSize: 14, color: 'inherit', lineHeight: 1.5 }}>{q}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <span className="font-system" style={{ fontSize: 9, color: '#555', letterSpacing: '0.12em' }}>
                      {msg.role === 'user' ? 'YOU' : 'AGENT'}
                    </span>
                    <div
                      className="font-narrative"
                      style={{
                        maxWidth: '88%', padding: '12px 16px', borderRadius: 'var(--radius-md)',
                        background: msg.role === 'user' ? 'var(--accent-dim)' : 'var(--surface-raised)',
                        border: `1px solid ${msg.role === 'user' ? 'rgba(255,128,0,0.25)' : 'var(--border-default)'}`,
                        fontSize: 14, lineHeight: 1.7,
                        color: msg.role === 'user' ? 'var(--text-primary)' : '#CCCCCC',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {msg.content}
                      {msg.role === 'assistant' && streaming && i === messages.length - 1 && msg.content === '' && (
                        <span style={{ display: 'inline-block', width: 7, height: 13, background: 'var(--accent)', marginLeft: 2, animation: 'blink 1s ease-in-out infinite' }} />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* input */}
              <form
                onSubmit={sendMessage}
                style={{ padding: '14px 18px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: 10, flexShrink: 0 }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`Query ${tab} agent...`}
                  disabled={streaming}
                  className="font-narrative"
                  style={{ flex: 1, background: 'var(--surface-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '11px 16px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 150ms' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(255,128,0,0.4)')}
                  onBlur={e  => (e.target.style.borderColor = 'var(--border-default)')}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || streaming}
                  className="font-display"
                  style={{
                    background: input.trim() && !streaming ? 'var(--accent)' : 'var(--surface-raised)',
                    border: `1px solid ${input.trim() && !streaming ? 'var(--accent)' : 'var(--border-default)'}`,
                    borderRadius: 'var(--radius-md)', padding: '11px 18px',
                    fontSize: 11, letterSpacing: '0.1em',
                    color: input.trim() && !streaming ? '#000' : 'var(--text-muted)',
                    cursor: input.trim() && !streaming ? 'pointer' : 'default',
                    transition: 'all 150ms ease',
                  }}
                >
                  {streaming ? '···' : 'SEND'}
                </button>
              </form>
            </motion.div>

          </motion.div>
        </AnimatePresence>

      </div>
      <DockNav />
    </div>
  )
}
