import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { term } from '../test/fixtures'
import { renderApp } from '../test/render'
import { Highlighted } from './Highlighted'

describe('Highlighted', () => {
  it('renders plain text without terms', () => {
    renderApp(<Highlighted text="Hallo Welt" terms={[]} side="source" onTerm={vi.fn()} />)
    expect(screen.getByText('Hallo Welt')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('makes each term a button with an informative title and reports clicks', async () => {
    const onTerm = vi.fn()
    const t = term({ source: 'Korpus', target: 'carcass' })
    renderApp(<Highlighted text="Der Korpus ist weiß" terms={[t]} side="source" onTerm={onTerm} />)
    const mark = screen.getByRole('button', { name: 'Korpus' })
    expect(mark).toHaveAttribute('title', 'Korpus → carcass')
    await userEvent.click(mark)
    expect(onTerm).toHaveBeenCalledWith(t)
  })

  it('is operable with the keyboard', async () => {
    const onTerm = vi.fn()
    renderApp(<Highlighted text="Korpus" terms={[term()]} side="source" onTerm={onTerm} />)
    screen.getByRole('button').focus()
    await userEvent.keyboard('{Enter}')
    expect(onTerm).toHaveBeenCalledOnce()
  })

  it('underlines a term whose glossary translation is missing', () => {
    renderApp(<Highlighted text="Korpus" terms={[term({ ok: false })]} side="source" onTerm={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveClass('underline')
  })
})
