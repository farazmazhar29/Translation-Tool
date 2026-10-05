import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { getToken } from '@/shared/api/client'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { AuthProvider } from '../auth'
import Register from '../Register'

const user = { id: 9, username: 'neu.person', full_name: 'Neue Person', role: 'translator', active: true }

const setup = () =>
  renderApp(
    <AuthProvider>
      <Register />
    </AuthProvider>,
  )

const fill = async (label: string, value: string) => {
  await userEvent.type(screen.getByLabelText(label), value)
}

describe('Register', () => {
  it('keeps the button disabled until the form is complete and the passwords match', async () => {
    setup()
    const submit = screen.getByRole('button', { name: 'Konto erstellen' })
    expect(submit).toBeDisabled()
    await fill('Benutzername', 'neu.person')
    await fill('Passwort', 'kurz')
    expect(screen.getByText('Mindestens 10 Zeichen.')).toHaveClass('text-red-700')
    await userEvent.clear(screen.getByLabelText('Passwort'))
    await fill('Passwort', 'ein-langes-passwort')
    await fill('Passwort wiederholen', 'ein-anderes-passwort')
    expect(screen.getByText('Die Passwörter stimmen nicht überein.')).toBeInTheDocument()
    expect(submit).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Passwort wiederholen'))
    await fill('Passwort wiederholen', 'ein-langes-passwort')
    expect(screen.queryByText('Die Passwörter stimmen nicht überein.')).not.toBeInTheDocument()
    expect(submit).toBeEnabled()
  })

  it('creates the account without signing in, and sends no role and no confirmation field', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/auth/register', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(user, { status: 201 })
      }),
    )
    setup()
    await fill('Vollständiger Name', 'Neue Person')
    await fill('Benutzername', 'neu.person')
    await fill('Passwort', 'ein-langes-passwort')
    await fill('Passwort wiederholen', 'ein-langes-passwort')
    await userEvent.click(screen.getByRole('button', { name: 'Konto erstellen' }))
    await waitFor(() => {
      expect(body).toEqual({ full_name: 'Neue Person', username: 'neu.person', password: 'ein-langes-passwort' })
    })
    expect(getToken()).toBeNull() // signing in is a separate step
  })

  it('shows the message of the server, for example for a taken username', async () => {
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json({ detail: 'Benutzername existiert bereits' }, { status: 409 }),
      ),
    )
    setup()
    await fill('Benutzername', 'admin')
    await fill('Passwort', 'ein-langes-passwort')
    await fill('Passwort wiederholen', 'ein-langes-passwort')
    await userEvent.click(screen.getByRole('button', { name: 'Konto erstellen' }))
    expect(await screen.findByText('Benutzername existiert bereits')).toBeInTheDocument()
    expect(getToken()).toBeNull()
  })

  it('says so when registration is switched off, and links back to the sign-in', async () => {
    server.use(http.get('*/api/auth/options', () => HttpResponse.json({ registration_enabled: false })))
    setup()
    expect(await screen.findByText(/Registrierung ist derzeit deaktiviert/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Konto erstellen' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login')
  })
})
