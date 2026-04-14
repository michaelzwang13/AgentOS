// Backend API client for the AgentOS frontend.
// Uses Vite proxy: /api/* → http://localhost:8000/*
// Or direct: VITE_API_URL=http://localhost:8000

const API_URL = import.meta.env.VITE_API_URL ?? ''
const API_PREFIX = API_URL ? '' : '/api'  // use proxy prefix when no direct URL

function url(path: string) {
  return `${API_URL}${API_PREFIX}${path}`
}

function apiKey(): string {
  return localStorage.getItem('openclaw_api_key') || ''
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey(),
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

export function isLoggedIn(): boolean {
  return !!apiKey()
}

export function getStoredUser(): { id: string; email: string; name: string } | null {
  const raw = localStorage.getItem('openclaw_user')
  return raw ? JSON.parse(raw) : null
}

export async function signup(email: string, name: string) {
  const res = await fetch(url('/users'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Signup failed')
  localStorage.setItem('openclaw_api_key', data.api_key)
  localStorage.setItem('openclaw_user', JSON.stringify(data))
  return data
}

export async function login(email: string) {
  const res = await fetch(url('/users/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Login failed')
  localStorage.setItem('openclaw_api_key', data.api_key)
  localStorage.setItem('openclaw_user', JSON.stringify(data))
  return data
}

export function logout() {
  localStorage.removeItem('openclaw_api_key')
  localStorage.removeItem('openclaw_user')
}

// ── Roles ───────────────────────────────────────────────────────────────────

export interface Role {
  id: string
  display_name: string
  description: string
  required_tools: string[]
}

export async function listRoles(): Promise<Role[]> {
  const res = await fetch(url('/roles'))
  if (!res.ok) throw new Error(`GET /roles failed: ${res.status}`)
  return res.json()
}

// ── Employees / Agents ──────────────────────────────────────────────────────

export async function hireEmployee(role: string, config: Record<string, unknown> = {}) {
  const res = await fetch(url('/agents'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ role, config }),
  })
  return res.json()
}

export async function listEmployees() {
  const res = await fetch(url('/agents'), { headers: headers() })
  if (!res.ok) return []
  return res.json()
}

export async function fireEmployee(agentId: string) {
  await fetch(url(`/agents/${agentId}`), { method: 'DELETE', headers: headers() })
}

export async function sendTask(agentId: string, instruction: string) {
  const res = await fetch(url(`/agents/${agentId}/tasks`), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ instruction }),
  })
  return res.json()
}

// ── Live Feeds ──────────────────────────────────────────────────────────────

export async function fetchSlackMessages() {
  const res = await fetch(url('/gateway/slack/messages'), { headers: headers() })
  return res.json()
}

export async function fetchGmailMessages() {
  const res = await fetch(url('/gateway/gmail/messages'), { headers: headers() })
  return res.json()
}

export async function fetchGithubActivity() {
  const res = await fetch(url('/gateway/github/activity'), { headers: headers() })
  return res.json()
}

export async function disconnectService(service: 'slack' | 'gmail' | 'github') {
  await fetch(url(`/gateway/${service}/disconnect`), { method: 'DELETE', headers: headers() })
}

// ── Digest ──────────────────────────────────────────────────────────────────

export interface DigestResponse {
  ok?: boolean
  channel?: string
  ts?: string
  digest?: string
  detail?: string  // error message when the backend returns 4xx/5xx
}

/**
 * Ask the backend to summarize Slack/Gmail/GitHub activity and post the digest to a
 * Slack channel. Defaults to #agentos.
 */
export async function postSlackDigest(channel: string = '#agentos'): Promise<DigestResponse> {
  const res = await fetch(url('/gateway/digest/slack'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ channel }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { detail: data.detail || `HTTP ${res.status}` }
  }
  return data
}

// ── OAuth ───────────────────────────────────────────────────────────────────

export function oauthUrl(service: 'slack' | 'gmail' | 'github'): string {
  // All OAuth flows go through the backend which handles token exchange + storage
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  return `${backendUrl}/auth/${service}?api_key=${encodeURIComponent(apiKey())}`
}

// ── Chat ────────────────────────────────────────────────────────────────────

export async function streamChat(
  agentId: string,
  context: string,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void,
) {
  const res = await fetch(url('/chat'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ agentId, context, messages }),
  })
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    full += dec.decode(value, { stream: true })
    onChunk(full)
  }
  return full
}
