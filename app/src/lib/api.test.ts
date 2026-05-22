import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isLoggedIn, getStoredUser, logout, signup, login, startOAuth } from './api'

/** A fetch stub that resolves once with the given JSON body. */
function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  })
}

describe('auth session helpers', () => {
  beforeEach(() => localStorage.clear())

  it('isLoggedIn reflects the stored API key', () => {
    expect(isLoggedIn()).toBe(false)
    localStorage.setItem('openclaw_api_key', 'oc_test')
    expect(isLoggedIn()).toBe(true)
  })

  it('getStoredUser returns null when nothing is stored', () => {
    expect(getStoredUser()).toBeNull()
  })

  it('getStoredUser parses the stored user', () => {
    localStorage.setItem('openclaw_user', JSON.stringify({ id: '1', email: 'a@b.com', name: 'Ada' }))
    expect(getStoredUser()).toEqual({ id: '1', email: 'a@b.com', name: 'Ada' })
  })

  it('logout clears the session', () => {
    localStorage.setItem('openclaw_api_key', 'oc_test')
    localStorage.setItem('openclaw_user', '{}')
    logout()
    expect(localStorage.getItem('openclaw_api_key')).toBeNull()
    expect(localStorage.getItem('openclaw_user')).toBeNull()
  })
})

describe('signup / login', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('signup stores the returned session', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ api_key: 'oc_new', id: '1', email: 'a@b.com', name: 'Ada' }))
    const data = await signup('a@b.com', 'Ada', 'supersecret')
    expect(data.api_key).toBe('oc_new')
    expect(localStorage.getItem('openclaw_api_key')).toBe('oc_new')
  })

  it('login surfaces the backend error message on failure', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ detail: 'Invalid email or password' }, false, 401))
    await expect(login('a@b.com', 'wrong-password')).rejects.toThrow('Invalid email or password')
  })
})

describe('startOAuth', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('returns the authorize_url and sends the API key as a header, never in the URL', async () => {
    localStorage.setItem('openclaw_api_key', 'oc_secret')
    const fetchMock = mockFetchOnce({ authorize_url: 'https://slack.com/oauth?x=1' })
    vi.stubGlobal('fetch', fetchMock)

    const authorizeUrl = await startOAuth('slack')
    expect(authorizeUrl).toBe('https://slack.com/oauth?x=1')

    const [calledUrl, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(calledUrl)).not.toContain('oc_secret')
    expect(opts.headers).toMatchObject({ 'X-Api-Key': 'oc_secret' })
  })
})
