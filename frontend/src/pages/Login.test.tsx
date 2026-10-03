import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { getToken } from '../api/client'
import { AuthProvider } from '../auth'
import { renderApp } from '../test/render'
import { server } from '../test/server'
import Login from './Login'

const user = { id: 1, username: 'translator', full_name: 'Tom', role: 'translator', active: true }

describe('Login', () => {
  it('stores the token after a successful login', async () => {
    let form = ''
    server.use(
      http.post('*/api/auth/login', async ({ request }) => {
        form = await request.text()
        return HttpResponse.json({ access_token: 'tok', token_type: 'bearer', user })
      }),
    )
    renderApp(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
    await waitFor(() => {
      expect(getToken()).toBe('tok')
    })
    expect(form).toContain('username=translator')
  })

  it('shows the server message for wrong credentials and stores nothing', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ detail: 'Benutzername oder Passwort falsch' }, { status: 401 }),
      ),
    )
    renderApp(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
    expect(await screen.findByText('Benutzername oder Passwort falsch')).toBeInTheDocument()
    expect(getToken()).toBeNull()
  })
})
