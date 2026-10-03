import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { ApiError, can, get, getToken, post, qs, session, setToken } from './client'

describe('qs', () => {
  it('skips empty values and encodes the rest', () => {
    expect(qs({ q: 'a b', status: '' })).toBe('?q=a+b')
    expect(qs({ q: '' })).toBe('')
  })
})

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

describe('request helpers', () => {
  it('sends the bearer token', async () => {
    setToken('abc')
    server.use(
      http.get('*/api/whoami', ({ request }) => HttpResponse.json({ auth: request.headers.get('authorization') })),
    )
    expect(await get<{ auth: string }>('/whoami')).toEqual({ auth: 'Bearer abc' })
  })

  it('turns a string error detail into an ApiError message', async () => {
    server.use(http.post('*/api/x', () => HttpResponse.json({ detail: 'Nicht erlaubt' }, { status: 403 })))
    const err = await post('/x', {}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 403, message: 'Nicht erlaubt' })
  })

  it('reads the message of a structured detail and keeps the raw detail', async () => {
    const detail = { message: 'Dublette gefunden', duplicates: [1] }
    server.use(http.post('*/api/y', () => HttpResponse.json({ detail }, { status: 409 })))
    const err = await post('/y', {}).catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 409, message: 'Dublette gefunden', detail })
  })

  it('expires the session on 401 (but not for the login call itself)', async () => {
    const expire = vi.spyOn(session, 'expire').mockImplementation(() => undefined)
    server.use(
      http.get('*/api/secret', () => new HttpResponse(null, { status: 401 })),
      http.post('*/api/auth/login', () => new HttpResponse(null, { status: 401 })),
    )
    await get('/secret').catch(() => undefined)
    expect(expire).toHaveBeenCalledOnce()
    await post('/auth/login', {}).catch(() => undefined)
    expect(expire).toHaveBeenCalledOnce()
  })

  it('removes the stored token when the session expires', () => {
    setToken('stale')
    const redirect = vi.spyOn(session, 'redirect').mockImplementation(() => undefined)
    session.expire()
    expect(getToken()).toBeNull()
    expect(redirect).toHaveBeenCalledOnce()
  })
})
