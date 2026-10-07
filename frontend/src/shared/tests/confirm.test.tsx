import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/testing/render'
import { useConfirm } from '../components/confirm'

const Harness = ({ destructive = false }: { destructive?: boolean }) => {
  const { confirm, dialog } = useConfirm()
  const [answer, setAnswer] = useState('nothing asked yet')
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void confirm({
            title: 'Projekt löschen?',
            message: 'Wirklich löschen?',
            confirmLabel: 'Löschen',
            destructive,
          }).then((ok) => {
            setAnswer(ok ? 'yes' : 'no')
          })
        }}
      >
        Fragen
      </button>
      <p>{answer}</p>
      {dialog}
    </>
  )
}

describe('useConfirm', () => {
  it('shows our own dialog with the title and the message instead of the browser dialog', async () => {
    renderApp(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fragen' }))
    expect(screen.getByRole('dialog', { name: 'Projekt löschen?' })).toBeInTheDocument()
    expect(screen.getByText('Wirklich löschen?')).toBeInTheDocument()
  })

  it('answers yes with the confirm button and closes the dialog', async () => {
    renderApp(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Fragen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))
    expect(await screen.findByText('yes')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([
    ['the cancel button', async () => userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))],
    ['the Escape key', async () => userEvent.keyboard('{Escape}')],
    ['the close icon', async () => userEvent.click(screen.getByRole('button', { name: 'Schließen' }))],
  ])('answers no with %s', async (_name, dismiss) => {
    renderApp(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Fragen' }))
    await dismiss()
    expect(await screen.findByText('no')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('makes the confirm button red for something that destroys data', async () => {
    renderApp(<Harness destructive />)
    await userEvent.click(screen.getByRole('button', { name: 'Fragen' }))
    expect(screen.getByRole('button', { name: 'Löschen' })).toHaveClass('bg-red-700')
  })
})
