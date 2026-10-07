import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { getToken } from '@/shared/api/session'
import { AuthProvider } from '../auth'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import Login from '../Login'

const user = { id: 1, username: 'translator', full_name: 'Tom', role: 'translator', active: true }

const fillIn = async (name: string, password: string) => {
  await userEvent.type(screen.getByLabelText('Benutzername'), name)
  await userEvent.type(screen.getByLabelText('Passwort'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
}

describe('Login', () => {
  it('starts with empty fields and shows no demo credentials', () => {
    renderApp(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    )
    expect(screen.getByLabelText('Benutzername')).toHaveValue('')
    expect(screen.getByLabelText('Passwort')).toHaveValue('')
    expect(screen.queryByText(/translator123|admin123|reviewer123/)).not.toBeInTheDocument()
  })

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
    await fillIn('translator', 'secret-password')
    await waitFor(() => {
      expect(getToken()).toBe('tok')
    })
    expect(form).toContain('username=translator')
    expect(form).toContain('password=secret-password')
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
    await fillIn('translator', 'wrong')
    expect(await screen.findByText('Benutzername oder Passwort falsch')).toBeInTheDocument()
    expect(getToken()).toBeNull()
  })

  it('confirms a new account when it arrives from the registration page', () => {
    renderApp(
      <AuthProvider>
        <Login />
      </AuthProvider>,
      { pathname: '/login', state: { registered: true } },
    )
    expect(screen.getByRole('status')).toHaveTextContent('Ihr Konto wurde erstellt')
  })

  it('shows no confirmation on a normal visit', () => {
    renderApp(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers to create an account', async () => {
    renderApp(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    )
    const link = await screen.findByRole('link', { name: 'Konto erstellen' })
    expect(link).toHaveAttribute('href', '/register')
  })

  it('hides the option when the administrator has switched registration off', async () => {
    server.use(http.get('*/api/auth/options', () => HttpResponse.json({ registration_enabled: false })))
    renderApp(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    )
    await screen.findByRole('button', { name: 'Anmelden' })
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Konto erstellen' })).not.toBeInTheDocument()
    })
  })
})
