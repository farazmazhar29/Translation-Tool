import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getToken, session, setToken } from '@/shared/api/client'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import { AuthProvider } from '../auth'
import { useAuth } from '../auth-context'

const user = { id: 1, username: 'translator', full_name: 'Tom', role: 'translator', active: true }

const Who = () => {
  const { user: current, loading } = useAuth()
  return <p>{loading ? 'loading' : (current?.username ?? 'anonymous')}</p>
}

const setup = () =>
  renderApp(
    <AuthProvider>
      <Who />
    </AuthProvider>,
  )

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AuthProvider', () => {
  it('is anonymous without a token and does not ask the server', () => {
    let asked = false
    server.use(
      http.get('*/api/users/current-user', () => {
        asked = true
        return HttpResponse.json(user)
      }),
    )
    setup()
    expect(screen.getByText('anonymous')).toBeInTheDocument()
    expect(asked).toBe(false)
  })

  it('restores the session from the stored token', async () => {
    setToken('stored')
    server.use(http.get('*/api/users/current-user', () => HttpResponse.json(user)))
    setup()
    expect(await screen.findByText('translator')).toBeInTheDocument()
  })

  it('stays signed in when the server is briefly unavailable, for example during a restart', async () => {
    setToken('stored')
    let calls = 0
    server.use(
      http.get('*/api/users/current-user', () => {
        calls += 1
        return calls < 3 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json(user)
      }),
    )
    setup()
    expect(screen.getByText('loading')).toBeInTheDocument() // not "anonymous": the page must not jump to the login
    expect(await screen.findByText('translator', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(calls).toBe(3)
    expect(getToken()).toBe('stored')
  })

  it('ends the session at once when the token is rejected, without retrying', async () => {
    setToken('expired')
    const redirect = vi.spyOn(session, 'redirect').mockImplementation(() => undefined)
    let calls = 0
    server.use(
      http.get('*/api/users/current-user', () => {
        calls += 1
        return HttpResponse.json({ detail: 'Nicht angemeldet' }, { status: 401 })
      }),
    )
    setup()
    expect(await screen.findByText('anonymous')).toBeInTheDocument()
    expect(calls).toBe(1)
    expect(getToken()).toBeNull()
    expect(redirect).toHaveBeenCalledOnce()
  })
})
