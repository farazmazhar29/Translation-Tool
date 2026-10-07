import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SaveStatus } from '../components/SaveStatus'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('SaveStatus', () => {
  it('shows nothing while a quick save runs, then "saved" for a moment', () => {
    const { rerender } = render(<SaveStatus pending={false} failed={false} />)
    rerender(<SaveStatus pending failed={false} />)
    advance(200)
    expect(screen.getByRole('status')).toBeEmptyDOMElement() // no flash for a quick save
    rerender(<SaveStatus pending={false} failed={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Gespeichert')
    advance(2000)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('says "saving" when an action takes longer', () => {
    const { rerender } = render(<SaveStatus pending={false} failed={false} />)
    rerender(<SaveStatus pending failed={false} />)
    advance(500)
    expect(screen.getByRole('status')).toHaveTextContent('Wird gespeichert')
  })

  it('does not claim "saved" when the action failed', () => {
    const { rerender } = render(<SaveStatus pending={false} failed={false} />)
    rerender(<SaveStatus pending failed={false} />)
    rerender(<SaveStatus pending={false} failed />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('is silent when nothing was saved yet', () => {
    render(<SaveStatus pending={false} failed={false} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
