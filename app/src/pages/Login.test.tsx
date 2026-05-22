import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

function renderLogin() {
  return render(<MemoryRouter><Login /></MemoryRouter>)
}

describe('Login', () => {
  beforeEach(() => localStorage.clear())

  it('renders the signup form with a password field', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'SIGN UP' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument()
  })

  it('warns when the password is shorter than 8 characters', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'short')
    expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument()
  })

  it('keeps the submit button disabled until the form is valid', async () => {
    const user = userEvent.setup()
    renderLogin()

    const submit = screen.getByRole('button', { name: 'GET STARTED' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByPlaceholderText('Your name'), 'Ada')
    await user.type(screen.getByPlaceholderText('you@company.com'), 'ada@example.com')
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'supersecret')

    expect(submit).toBeEnabled()
  })
})
