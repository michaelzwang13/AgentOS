import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): React.ReactElement {
  throw new Error('kaboom')
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><div>all good</div></ErrorBoundary>)
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows the recoverable fallback when a child throws', () => {
    // React logs the caught render error — silence it for a clean run.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText('Something broke')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
