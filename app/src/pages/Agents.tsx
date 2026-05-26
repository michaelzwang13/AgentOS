import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { Layers, GitPullRequest, CircleDot, AtSign, Workflow, MoreHorizontal, ChevronDown, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  isLoggedIn,
  fetchSlackMessages,
  fetchGmailMessages,
  fetchGithubActivity,
  disconnectService,
  startOAuth,
  streamChat,
  postSlackDigest,
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
type GhCategory = 'pr' | 'issue' | 'mention' | 'ci' | 'other'
interface GithubItem {
  id: string; repo: string; title: string; type: string; reason: string; time: string; unread: boolean;
  author?: string; state?: string;
  category?: GhCategory; actor?: string; html_url?: string;
}
interface ChatMsg { role: 'user' | 'assistant'; content: string }
type Tab = 'slack' | 'gmail' | 'github'
type GhFilter = 'all' | GhCategory

const GH_FILTERS: { id: GhFilter; label: string; icon: LucideIcon }[] = [
  { id: 'all',     label: 'All',      icon: Layers },
  { id: 'pr',      label: 'PRs',      icon: GitPullRequest },
  { id: 'issue',   label: 'Issues',   icon: CircleDot },
  { id: 'mention', label: 'Mentions', icon: AtSign },
  { id: 'ci',      label: 'CI',       icon: Workflow },
  { id: 'other',   label: 'Other',    icon: MoreHorizontal },
]

// Markdown overrides for assistant chat bubbles. Defined at module scope so
// React doesn't re-create the object on every render. Tokens come from
// index.css; only the inline declarations matter for layout/spacing.
const MD_COMPONENTS: Components = {
  p:  ({ children }) => <p style={{ margin: '0 0 10px', lineHeight: 1.65 }}>{children}</p>,
  ul: ({ children }) => <ul style={{ margin: '6px 0 10px', paddingLeft: '1.25em' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '6px 0 10px', paddingLeft: '1.25em' }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '0 0 4px' }}>{children}</li>,
  strong: ({ children }) => <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3 }}
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    // ReactMarkdown passes the language class for fenced blocks; inline code
    // has no className. The `pre` override handles the fenced-block container.
    const isBlock = !!className
    if (isBlock) return <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{children}</code>
    return (
      <code style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        background: 'var(--surface)',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
      }}>{children}</code>
    )
  },
  pre: ({ children }) => (
    <pre style={{
      background: 'var(--surface)',
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-subtle)',
      overflowX: 'auto',
      margin: '8px 0 12px',
    }}>{children}</pre>
  ),
  h1: ({ children }) => <h1 style={{ fontSize: 18, fontWeight: 600, margin: '8px 0 4px' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: 16, fontWeight: 600, margin: '8px 0 4px' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 600, margin: '6px 0 4px' }}>{children}</h3>,
}

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
  { id: 'g1', category: 'pr',      repo: 'acme/frontend', title: 'feat: redesign checkout flow',           type: 'PR',    reason: 'review requested', time: '2h ago',    unread: true,  author: 'jdoe',     state: 'open'  },
  { id: 'g2', category: 'pr',      repo: 'acme/backend',  title: 'fix: race condition in session handler', type: 'PR',    reason: 'review requested', time: '4h ago',    unread: true,  author: 'priya-n',  state: 'open'  },
  { id: 'g3', category: 'mention', repo: 'acme/frontend', title: 'CI failing on main — lint error',        type: 'Issue', reason: 'mentioned',        time: '5h ago',    unread: true                                      },
  { id: 'g4', category: 'pr',      repo: 'acme/infra',    title: 'chore: bump node to 22 LTS',            type: 'PR',    reason: 'subscribed',       time: 'Yesterday', unread: false, author: 'marcus-r', state: 'draft' },
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

  const [slackConn,  setSlackConn]  = useState(false)
  const [gmailConn,  setGmailConn]  = useState(false)
  const [githubConn, setGithubConn] = useState(false)

  const [slackData,  setSlackData]  = useState<SlackMessage[]>(MOCK_SLACK)
  const [gmailData,  setGmailData]  = useState<Email[]>(MOCK_GMAIL)
  const [githubData, setGithubData] = useState<GithubItem[]>(MOCK_GITHUB)
  const [feedLoading, setFeedLoading] = useState(true)

  const [messages,  setMessages]  = useState<ChatMsg[]>([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const [digestBusy, setDigestBusy] = useState(false)
  const [digestStatus, setDigestStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [connecting, setConnecting] = useState(false)

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

  // OAuth redirect params — also flip the active tab to whichever tool the
  // user just connected, so they land on its feed instead of the Slack default.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('connected') === 'true' || p.get('connected') === 'slack') {
      setTab('slack')
      fetchSlackMessages().then(d => { if (d.connected) { setSlackConn(true); setSlackData(d.messages) } })
    }
    if (p.get('gmail_connected')) {
      setTab('gmail')
      fetchGmailMessages().then(d => { if (d.connected) { setGmailConn(true); setGmailData(d.emails) } })
    }
    if (p.get('github_connected')) {
      setTab('github')
      fetchGithubActivity().then(d => { if (d.connected) { setGithubConn(true); setGithubData(d.items) } })
    }
    if (p.toString()) window.history.replaceState({}, '', '/agents')
  }, [])

  useEffect(() => { setMessages([]); setInput('') }, [tab])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── GitHub filter state ──────────────────
  const [ghCategory, setGhCategory] = useState<GhFilter>('all')
  const [ghRepo, setGhRepo] = useState<'all' | string>('all')
  // Reset filters when the underlying data refreshes — avoids stranding the
  // user on a filter that matches nothing.
  useEffect(() => { setGhCategory('all'); setGhRepo('all') }, [githubData])

  const filteredGithub = useMemo(() => githubData.filter(it => {
    if (ghCategory !== 'all' && (it.category ?? 'other') !== ghCategory) return false
    if (ghRepo !== 'all' && it.repo !== ghRepo) return false
    return true
  }), [githubData, ghCategory, ghRepo])

  const ghCategoryCounts = useMemo(() => {
    const counts: Record<GhFilter, number> = { all: githubData.length, pr: 0, issue: 0, mention: 0, ci: 0, other: 0 }
    githubData.forEach(it => { counts[(it.category ?? 'other') as GhCategory]++ })
    return counts
  }, [githubData])

  const ghRepos = useMemo(() => {
    const counts = new Map<string, number>()
    githubData.forEach(it => { if (it.repo) counts.set(it.repo, (counts.get(it.repo) ?? 0) + 1) })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([repo]) => repo)
  }, [githubData])

  const connected = tab === 'slack' ? slackConn : tab === 'gmail' ? gmailConn : githubConn
  const unreadCount = (items: SlackMessage[] | Email[] | GithubItem[]) =>
    items.filter(i => 'read' in i ? !i.read : (i as GithubItem).unread).length

  const getContext = useCallback(
    () => buildContext(tab, slackData, gmailData, filteredGithub),
    [tab, slackData, gmailData, filteredGithub]
  )

  async function handleConnect() {
    if (connecting) return
    setConnecting(true)
    try {
      window.location.href = await startOAuth(tab)
    } catch {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    await disconnectService(tab as 'slack' | 'gmail' | 'github')
    if (tab === 'slack')  { setSlackConn(false);  setSlackData(MOCK_SLACK)   }
    if (tab === 'gmail')  { setGmailConn(false);  setGmailData(MOCK_GMAIL)   }
    if (tab === 'github') { setGithubConn(false); setGithubData(MOCK_GITHUB) }
  }

  async function handlePostDigest() {
    if (digestBusy) return
    setDigestBusy(true)
    setDigestStatus(null)
    try {
      const res = await postSlackDigest('#agentos')
      if (res.ok) {
        setDigestStatus({ kind: 'ok', text: `Posted to ${res.channel}` })
      } else {
        setDigestStatus({ kind: 'err', text: res.detail || 'Failed to post digest' })
      }
    } catch {
      setDigestStatus({ kind: 'err', text: 'Could not reach the server' })
    } finally {
      setDigestBusy(false)
      setTimeout(() => setDigestStatus(null), 6000)
    }
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
    } catch {
      setMessages(m => {
        const u = [...m]
        u[u.length - 1] = {
          role: 'assistant',
          content: 'Sorry — I couldn’t reach the agent. Check your connection and try again.',
        }
        return u
      })
    } finally {
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'slack',  label: 'Slack'  },
    { id: 'gmail',  label: 'Gmail'  },
    { id: 'github', label: 'GitHub' },
  ]

  return (
    <div className="dot-grid" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 40px 96px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1 style={{
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
            }}>
              Signal feed
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 460, lineHeight: 1.55 }}>
              Live streams from your connected tools. Query each agent inline.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              {[
                { code: 'Slack',  live: slackConn },
                { code: 'Gmail',  live: gmailConn },
                { code: 'GitHub', live: githubConn },
              ].map(({ code, live }) => (
                <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: live ? 'var(--accent)' : 'var(--status-idle)',
                    animation: live ? 'pulse-status 1.5s ease-in-out infinite' : 'none',
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: live ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                  }}>
                    {code}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-tertiary)' }}>{clock}</span>
            <button
              onClick={handlePostDigest}
              disabled={digestBusy}
              style={{
                background: digestBusy ? 'var(--surface-raised)' : 'var(--accent)',
                border: `1px solid ${digestBusy ? 'var(--border-default)' : 'var(--accent)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                color: digestBusy ? 'var(--text-tertiary)' : '#000',
                cursor: digestBusy ? 'default' : 'pointer',
                transition: 'background 120ms ease',
              }}
              onMouseEnter={e => { if (!digestBusy) e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={e => { if (!digestBusy) e.currentTarget.style.background = 'var(--accent)' }}
            >
              {digestBusy ? 'Posting…' : 'Post digest to #agentos'}
            </button>
            {digestStatus && (
              <span style={{
                fontSize: 12,
                color: digestStatus.kind === 'ok' ? 'var(--accent)' : 'var(--status-error)',
                maxWidth: 260,
                textAlign: 'right',
              }}>
                {digestStatus.text}
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Tab strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.25 }}
          style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: 2 }}
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
                  padding: '10px 16px',
                  marginBottom: -1,
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  transition: 'color 120ms ease',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-tertiary)' }}
              >
                <span>{t.label}</span>
                {n > 0 && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    background: active ? 'var(--accent)' : 'var(--surface-raised)',
                    color: active ? '#000' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '1px 7px',
                    fontWeight: 600,
                  }}>
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
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >

            {/* ── Feed panel ── */}
            <div style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: 600,
            }}>
              {/* header */}
              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {tab} feed
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: connected ? 'var(--accent)' : 'var(--status-idle)',
                      animation: connected ? 'pulse-status 1.5s ease-in-out infinite' : 'none',
                    }} />
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {connected ? 'Live' : 'Demo'}
                    </span>
                  </div>
                  {!connected ? (
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      style={{
                        fontSize: 12,
                        color: 'var(--accent)',
                        padding: '4px 12px',
                        border: '1px solid var(--accent)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'transparent',
                        cursor: connecting ? 'default' : 'pointer',
                        transition: 'background 120ms',
                        fontWeight: 500,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {connecting ? 'Connecting…' : 'Connect'}
                    </button>
                  ) : (
                    <button
                      onClick={handleDisconnect}
                      style={{ fontSize: 12, color: 'var(--text-tertiary)', transition: 'color 120ms ease' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--status-error)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {/* items */}
              {feedLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[0, 150, 300].map(d => (
                      <div key={d} style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: 'var(--text-tertiary)',
                        animation: `pulse-status 1.2s ease-in-out ${d}ms infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {tab === 'slack' && slackData.map((msg, i) => (
                    <FeedRow key={msg.id} index={i} unread={!msg.read}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: !msg.read ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {msg.user}
                          </span>
                          <Pill tone="accent">#{msg.channel}</Pill>
                          {msg.priority === 'high' && <Pill tone="error">Urgent</Pill>}
                        </div>
                        <Meta>{msg.time}</Meta>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{msg.text}</p>
                    </FeedRow>
                  ))}

                  {tab === 'gmail' && gmailData.map((email, i) => (
                    <FeedRow key={email.id} index={i} unread={!email.read}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: !email.read ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {email.from}
                          </span>
                          {email.priority === 'high' && <Pill tone="error">Urgent</Pill>}
                        </div>
                        <Meta>{email.time}</Meta>
                      </div>
                      <p style={{ margin: '0 0 5px', fontSize: 13, fontWeight: 500, color: !email.read ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {email.subject}
                      </p>
                      <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
                        {email.body}
                      </p>
                      {email.labels.length > 0 && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          {email.labels.map(l => <Pill key={l} tone="neutral">{l}</Pill>)}
                        </div>
                      )}
                    </FeedRow>
                  ))}

                  {tab === 'github' && (
                    <>
                      <GhFilterBar
                        category={ghCategory}
                        repo={ghRepo}
                        counts={ghCategoryCounts}
                        repos={ghRepos}
                        onCategory={setGhCategory}
                        onRepo={setGhRepo}
                      />
                      {filteredGithub.length === 0 ? (
                        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                          <Meta>No GitHub events match these filters.</Meta>
                        </div>
                      ) : filteredGithub.map((item, i) => (
                        <FeedRow key={item.id} index={i} unread={item.unread}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <TypeBadge category={item.category} typeLabel={item.type} />
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{item.repo}</span>
                              {item.state === 'draft' && <Pill tone="neutral">Draft</Pill>}
                            </div>
                            <Meta>{item.time}</Meta>
                          </div>
                          {item.html_url ? (
                            <a
                              href={item.html_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'block', textDecoration: 'none' }}
                            >
                              <p style={{
                                margin: '0 0 6px',
                                fontSize: 14,
                                color: item.unread ? 'var(--text-primary)' : 'var(--text-secondary)',
                                lineHeight: 1.5,
                                transition: 'color 120ms ease',
                              }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                                onMouseLeave={e => (e.currentTarget.style.color = item.unread ? 'var(--text-primary)' : 'var(--text-secondary)')}
                              >
                                {item.title}
                              </p>
                            </a>
                          ) : (
                            <p style={{ margin: '0 0 6px', fontSize: 14, color: item.unread ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {item.title}
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: 12 }}>
                            <Meta>{item.reason}</Meta>
                            {(item.actor || item.author) && <Meta>@{item.actor || item.author}</Meta>}
                          </div>
                        </FeedRow>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Query panel ── */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.25 }}
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                height: 600,
              }}
            >
              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  Query · {tab} agent
                </span>
              </div>

              {/* messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}>
                      Suggested queries
                    </span>
                    {SUGGESTED[tab].map((q, i) => (
                      <motion.button
                        key={q}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.18 + i * 0.05, duration: 0.25 }}
                        onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50) }}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '11px 14px',
                          textAlign: 'left',
                          color: 'var(--text-secondary)',
                          transition: 'border-color 120ms ease, color 120ms ease, background 120ms ease',
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--border-default)'
                          e.currentTarget.style.color = 'var(--text-primary)'
                          e.currentTarget.style.background = 'var(--surface-hover)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)'
                          e.currentTarget.style.color = 'var(--text-secondary)'
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        {q}
                      </motion.button>
                    ))}
                  </motion.div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}>
                      {msg.role === 'user' ? 'You' : 'Agent'}
                    </span>
                    <div
                      style={{
                        maxWidth: '92%',
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: msg.role === 'user' ? 'var(--accent-subtle)' : 'var(--surface-raised)',
                        border: `1px solid ${msg.role === 'user' ? 'rgba(255,128,0,0.25)' : 'var(--border-subtle)'}`,
                        fontSize: 14,
                        lineHeight: 1.65,
                        color: 'var(--text-primary)',
                        whiteSpace: msg.role === 'user' ? 'pre-wrap' : 'normal',
                      }}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="agent-md">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                      {msg.role === 'assistant' && streaming && i === messages.length - 1 && msg.content === '' && (
                        <span style={{
                          display: 'inline-block',
                          width: 6,
                          height: 13,
                          background: 'var(--accent)',
                          marginLeft: 2,
                          animation: 'blink 1s ease-in-out infinite',
                        }} />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* input */}
              <form
                onSubmit={sendMessage}
                style={{
                  padding: '12px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`Query ${tab} agent…`}
                  disabled={streaming}
                  style={{
                    flex: 1,
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '9px 14px',
                    fontSize: 14,
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--accent)'
                    e.target.style.boxShadow = '0 0 0 3px var(--accent-ring)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--border-default)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || streaming}
                  style={{
                    background: input.trim() && !streaming ? 'var(--accent)' : 'var(--surface-raised)',
                    border: `1px solid ${input.trim() && !streaming ? 'var(--accent)' : 'var(--border-default)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '9px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: input.trim() && !streaming ? '#000' : 'var(--text-tertiary)',
                    cursor: input.trim() && !streaming ? 'pointer' : 'default',
                    transition: 'background 120ms ease',
                  }}
                >
                  {streaming ? '···' : 'Send'}
                </button>
              </form>
            </motion.div>

          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  )
}

// ── small composables ────────────────────────────────────────────────────────

function FeedRow({ index, unread, children }: { index: number; unread: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        borderLeft: unread ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </motion.div>
  )
}

type PillTone = 'accent' | 'error' | 'neutral' | 'success'

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const styles: Record<PillTone, React.CSSProperties> = {
    accent:  { color: 'var(--accent)',       background: 'var(--accent-subtle)',  border: '1px solid transparent' },
    error:   { color: 'var(--status-error)', background: 'rgba(248,113,113,0.10)', border: '1px solid transparent' },
    neutral: { color: 'var(--text-secondary)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' },
    success: { color: '#10B981',             background: 'rgba(16,185,129,0.10)',  border: '1px solid transparent' },
  }
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      borderRadius: 4,
      padding: '2px 7px',
      letterSpacing: '0.02em',
      ...styles[tone],
    }}>
      {children}
    </span>
  )
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-tertiary)',
    }}>
      {children}
    </span>
  )
}

function GhFilterBar({ category, repo, counts, repos, onCategory, onRepo }: {
  category: GhFilter
  repo: 'all' | string
  counts: Record<GhFilter, number>
  repos: string[]
  onCategory: (c: GhFilter) => void
  onRepo: (r: 'all' | string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {GH_FILTERS.map(f => (
          <FilterPill
            key={f.id}
            label={f.label}
            icon={f.icon}
            count={counts[f.id]}
            active={category === f.id}
            onClick={() => onCategory(f.id)}
          />
        ))}
      </div>
      {repos.length > 0 && (
        <RepoSelect value={repo} options={repos} onChange={onRepo} />
      )}
    </motion.div>
  )
}

function FilterPill({ label, icon: Icon, count, active, onClick }: {
  label: string
  icon: LucideIcon
  count: number
  active: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 'var(--radius-pill)',
          border: active ? '1px solid var(--accent-ring)' : '1px solid var(--border-subtle)',
          background: active ? 'var(--accent-subtle)' : hover ? 'var(--surface-hover)' : 'transparent',
          color: active ? 'var(--accent)' : hover ? 'var(--text-primary)' : 'var(--text-tertiary)',
          cursor: 'pointer',
          transition: 'color 120ms ease, background 120ms ease, border-color 120ms ease',
        }}
      >
        <Icon size={13} strokeWidth={2} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: active ? 'var(--accent)' : 'var(--text-disabled)',
          lineHeight: 1,
        }}>
          {count}
        </span>
      </button>
      {hover && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

// Driven by item.category so a 'mention'-bucket PR shows the AtSign even
// though item.type is still 'PR'. Tooltip = the raw GitHub type string so
// the precision info ('CheckSuite', 'RepositoryInvitation') survives.
const TYPE_BADGE_STYLE: Record<GhCategory, { icon: LucideIcon; tone: PillTone }> = {
  pr:      { icon: GitPullRequest,  tone: 'success' },
  issue:   { icon: CircleDot,       tone: 'neutral' },
  mention: { icon: AtSign,          tone: 'accent'  },
  ci:      { icon: Workflow,        tone: 'neutral' },
  other:   { icon: MoreHorizontal,  tone: 'neutral' },
}
const TYPE_BADGE_BG: Record<PillTone, React.CSSProperties> = {
  accent:  { color: 'var(--accent)',         background: 'var(--accent-subtle)',     border: '1px solid transparent' },
  error:   { color: 'var(--status-error)',   background: 'rgba(248,113,113,0.10)',   border: '1px solid transparent' },
  neutral: { color: 'var(--text-secondary)', background: 'var(--surface-raised)',    border: '1px solid var(--border-subtle)' },
  success: { color: '#10B981',               background: 'rgba(16,185,129,0.10)',    border: '1px solid transparent' },
}

function TypeBadge({ category, typeLabel }: { category?: GhCategory; typeLabel: string }) {
  const { icon: Icon, tone } = TYPE_BADGE_STYLE[category ?? 'other']
  const [hover, setHover] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <span
        aria-label={typeLabel}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 18,
          borderRadius: 4,
          ...TYPE_BADGE_BG[tone],
        }}
      >
        <Icon size={11} strokeWidth={2.2} />
      </span>
      {hover && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {typeLabel}
        </div>
      )}
    </div>
  )
}

function RepoSelect({ value, options, onChange }: {
  value: 'all' | string
  options: string[]
  onChange: (v: 'all' | string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Close on click-outside or Escape.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = value === 'all' ? 'All repos' : value

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          padding: '5px 10px',
          background: open ? 'var(--surface-hover)' : 'var(--surface-raised)',
          border: `1px solid ${open ? 'var(--border-default)' : 'var(--border-subtle)'}`,
          color: 'var(--text-secondary)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          transition: 'background 120ms ease, border-color 120ms ease',
          maxWidth: 200,
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.borderColor = 'var(--border-default)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
      >
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'var(--text-primary)',
        }}>{label}</span>
        <ChevronDown size={12} style={{
          color: 'var(--text-tertiary)',
          transition: 'transform 150ms ease',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          flexShrink: 0,
        }} />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: '100%',
            maxWidth: 340,
            maxHeight: 280,
            overflowY: 'auto',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 20,
            padding: 4,
          }}
        >
          <RepoOption
            label="All repos"
            selected={value === 'all'}
            onClick={() => { onChange('all'); setOpen(false) }}
          />
          {options.map(r => (
            <RepoOption
              key={r}
              label={r}
              selected={value === r}
              onClick={() => { onChange(r); setOpen(false) }}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}

function RepoOption({ label, selected, onClick }: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role="option"
      aria-selected={selected}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        padding: '6px 8px',
        background: hover ? 'var(--surface-hover)' : 'transparent',
        color: selected ? 'var(--accent)' : 'var(--text-secondary)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        transition: 'background 100ms ease, color 100ms ease',
      }}
    >
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>{label}</span>
      {selected && <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
    </button>
  )
}
