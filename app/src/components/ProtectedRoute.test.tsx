import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route
          path="/secret"
          element={<ProtectedRoute><div>secret page</div></ProtectedRoute>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => localStorage.clear())

  it('redirects to /login when the user is not authenticated', () => {
    renderAt('/secret')
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('secret page')).not.toBeInTheDocument()
  })

  it('renders the protected children when authenticated', () => {
    localStorage.setItem('openclaw_api_key', 'oc_test')
    renderAt('/secret')
    expect(screen.getByText('secret page')).toBeInTheDocument()
  })
})
