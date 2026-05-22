import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

/**
 * jsdom's localStorage isn't reliably available under Vitest 4 / Node's
 * experimental Web Storage. Install a clean in-memory implementation before
 * every test so storage-backed code (auth session, route guards) is
 * deterministic and isolated.
 */
class MemoryStorage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear() { this.store.clear() }
  getItem(key: string) { return this.store.get(key) ?? null }
  key(index: number) { return [...this.store.keys()][index] ?? null }
  removeItem(key: string) { this.store.delete(key) }
  setItem(key: string, value: string) { this.store.set(key, String(value)) }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
})

// Unmount React trees between tests so the DOM never bleeds across cases.
afterEach(() => cleanup())
