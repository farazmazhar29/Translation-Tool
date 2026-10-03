import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { segment } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { SegmentRow } from '../components/SegmentRow'

const setup = (over: Partial<Parameters<typeof SegmentRow>[0]> = {}) => {
  const props = { onTerm: vi.fn(), onSave: vi.fn(), onRegenerate: vi.fn() }
  renderApp(<SegmentRow seg={segment()} lang="en" editable busy={false} {...props} {...over} />)
  return props
}

describe('SegmentRow', () => {
  it('shows the source text and its translation', () => {
    setup()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText(/Der/)).toBeInTheDocument()
    expect(screen.getByText(/The/)).toBeInTheDocument()
  })

  it('says so when the segment has no translation in this language', () => {
    setup({ lang: 'de' })
    expect(screen.getByText('Noch nicht übersetzt')).toBeInTheDocument()
  })

  it('saves an edited translation and closes the editor', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Bearbeiten/ }))
    const area = screen.getByLabelText('Übersetzung bearbeiten')
    await userEvent.clear(area)
    await userEvent.type(area, 'Neu')
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), { text: 'Neu' })
    expect(screen.queryByLabelText('Übersetzung bearbeiten')).not.toBeInTheDocument()
  })

  it('discards the draft on cancel', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Bearbeiten/ }))
    await userEvent.type(screen.getByLabelText('Übersetzung bearbeiten'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('offers no editing when the project is not editable', () => {
    setup({ editable: false })
    expect(screen.queryByRole('button', { name: /Bearbeiten/ })).not.toBeInTheDocument()
  })

  it('regenerates the translation', async () => {
    const { onRegenerate } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Neu erzeugen/ }))
    expect(onRegenerate).toHaveBeenCalledOnce()
  })
})
