import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/testing/server'
import { API_CONFIG, ApiError, AS_FILE, errorText, saveFile } from '../api/config'
import { AuthApiFactory, ProjectsApiFactory, UsersApiFactory } from '../api/generated'
import { can, getToken, session, setToken } from '../api/session'

const users = UsersApiFactory(API_CONFIG)
const projects = ProjectsApiFactory(API_CONFIG)
const auth = AuthApiFactory(API_CONFIG)

describe('can (role hierarchy)', () => {
  const user = (role: 'translator' | 'reviewer' | 'admin') => ({
    id: 1,
    username: 'u',
    full_name: '',
    role,
    active: true,
  })
  it('admin may do everything, translator only the lowest level', () => {
    expect(can(user('admin'), 'reviewer')).toBe(true)
    expect(can(user('reviewer'), 'admin')).toBe(false)
    expect(can(user('translator'), 'translator')).toBe(true)
    expect(can(null, 'translator')).toBe(false)
  })
})

describe('API configuration (every generated factory)', () => {
  it('sends the bearer token', async () => {
    setToken('abc')
    let auth: string | null = null
    server.use(
      http.get('*/api/users/names', ({ request }) => {
        auth = request.headers.get('authorization')
        return HttpResponse.json([])
      }),
    )
    await users.userNames()
    expect(auth).toBe('Bearer abc')
  })

  it('calls the API under /api of the same origin', async () => {
    let url = ''
    server.use(
      http.get('*/api/projects/7', ({ request }) => {
        url = new URL(request.url).pathname
        return HttpResponse.json({})
      }),
    )
    await projects.getProjectDetail({ pid: 7 })
    expect(url).toBe('/api/projects/7')
  })

  it('turns a string error detail into an ApiError message', async () => {
    server.use(http.get('*/api/users/names', () => HttpResponse.json({ detail: 'Nicht erlaubt' }, { status: 403 })))
    const err = await users.userNames().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 403, message: 'Nicht erlaubt' })
  })

  it('words an error code in the interface language, with its params', async () => {
    const body = { detail: 'Too many failed attempts.', code: 'too_many_attempts', params: { minutes: 3 } }
    server.use(http.get('*/api/users/names', () => HttpResponse.json(body, { status: 429 })))
    const err = await users.userNames().catch((e: unknown) => e)
    expect(err).toMatchObject({
      status: 429,
      code: 'too_many_attempts',
      message: 'Zu viele Fehlversuche. Bitte in 3 Minute(n) erneut versuchen.',
    })
  })

  it("keeps the server's text for a code the interface does not know", async () => {
    const body = { detail: 'Something new', code: 'brand_new_code', params: {} }
    server.use(http.get('*/api/users/names', () => HttpResponse.json(body, { status: 400 })))
    const err = await users.userNames().catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 400, code: 'brand_new_code', message: 'Something new' })
  })

  it('words a stored error code, like the error of a failed translation job', () => {
    expect(errorText('server_restarted', {}, 'The server was restarted.')).toBe(
      'Der Server wurde neu gestartet. Bitte die Übersetzung neu starten.',
    )
    expect(errorText('', {}, 'old German text')).toBe('old German text')
  })

  it('reads the message of a structured detail and keeps the raw detail', async () => {
    const detail = { message: 'Dublette gefunden', duplicates: [1] }
    server.use(http.post('*/api/projects/1/copy', () => HttpResponse.json({ detail }, { status: 409 })))
    const err = await projects.copyProject({ pid: 1 }).catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 409, message: 'Dublette gefunden', detail })
  })

  it('reads the error of a failed download, which arrives as a file', async () => {
    server.use(
      http.get('*/api/projects/1/original', () => HttpResponse.json({ detail: 'Datei fehlt' }, { status: 404 })),
    )
    const err = await projects.downloadOriginal({ pid: 1 }, AS_FILE).catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 404, message: 'Datei fehlt' })
  })

  it('expires the session on 401 (but not for the login call itself)', async () => {
    const expire = vi.spyOn(session, 'expire').mockImplementation(() => undefined)
    server.use(
      http.get('*/api/users/names', () => new HttpResponse(null, { status: 401 })),
      http.post('*/api/auth/login', () => new HttpResponse(null, { status: 401 })),
    )
    await users.userNames().catch(() => undefined)
    expect(expire).toHaveBeenCalledOnce()
    await auth.login({ username: 'a', password: 'b' }).catch(() => undefined)
    expect(expire).toHaveBeenCalledOnce()
  })

  it('removes the stored token when the session expires', () => {
    setToken('stale')
    const redirect = vi.spyOn(session, 'redirect').mockImplementation(() => undefined)
    session.expire()
    expect(getToken()).toBeNull()
    expect(redirect).toHaveBeenCalledOnce()
  })

  it('saves a downloaded file under the given name', async () => {
    server.use(http.get('*/api/projects/1/original', () => new HttpResponse(new Blob(['%PDF']), { status: 200 })))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    await saveFile(projects.downloadOriginal({ pid: 1 }, AS_FILE), 'plan.pdf')
    expect(click).toHaveBeenCalledOnce()
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('plan.pdf')
  })
})
