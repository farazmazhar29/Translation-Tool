import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth'
import type { UserOut } from '@/shared/api/generated'
import { setToken } from '@/shared/api/session'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import Users from '../Users'

const user = (id: number, username: string, role: UserOut['role'] = 'translator'): UserOut => ({
  id,
  username,
  full_name: '',
  role,
  active: true,
})

const setup = () => {
  setToken('t')
  const deleted: number[] = []
  server.use(
    http.get('*/api/users/current-user', () => HttpResponse.json(user(1, 'admin', 'admin'))),
    http.get('*/api/users', () => HttpResponse.json([user(1, 'admin', 'admin'), user(2, 'max')])),
    http.delete('*/api/users/:uid', ({ params }) => {
      deleted.push(Number(params['uid']))
      return HttpResponse.json({ deleted: true })
    }),
  )
  renderApp(
    <AuthProvider>
      <Users />
    </AuthProvider>,
  )
  return deleted
}

const row = async (name: string) => {
  const cell = await screen.findByText(name, { selector: 'span' })
  const tr = cell.closest('tr')
  if (!tr) throw new Error(`no row for ${name}`)
  return within(tr)
}

describe('Users', () => {
  it('deletes a user after asking, and explains that the name stays in the history', async () => {
    const deleted = setup()
    await userEvent.click((await row('max')).getByRole('button', { name: 'Löschen' }))
    const dialog = await screen.findByRole('dialog', { name: 'Benutzer löschen?' })
    expect(dialog).toHaveTextContent('bleibt der Name erhalten')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }))
    await waitFor(() => {
      expect(deleted).toEqual([2])
    })
  })

  it('does not offer to delete your own account', async () => {
    setup()
    expect((await row('admin')).queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument()
    expect((await row('max')).getByRole('button', { name: 'Löschen' })).toBeInTheDocument()
  })

  it('creates a new user without an "active" choice: new accounts are always active', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Benutzer hinzufügen' }))
    const dialog = await screen.findByRole('dialog', { name: 'Neuer Benutzer' })
    expect(within(dialog).queryByLabelText('Aktiv')).not.toBeInTheDocument()
  })
})
