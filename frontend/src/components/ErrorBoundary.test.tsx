import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('kaputt')
}

describe('ErrorBoundary', () => {
  it('renders children when nothing fails', () => {
    render(<ErrorBoundary>alles gut</ErrorBoundary>)
    expect(screen.getByText('alles gut')).toBeInTheDocument()
  })

  it('shows an accessible recovery message instead of a blank page when a child crashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined) // React logs the caught error
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Etwas ist schiefgelaufen')
    expect(screen.getByRole('button', { name: 'Zur Startseite' })).toBeInTheDocument()
  })
})
