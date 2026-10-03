import type { components } from './schema'

/** Types generated from the backend's Swagger schema (`npm run gen:api`). */
export type S = components['schemas']
export type Lang = 'de' | 'en'
export type Role = S['UserOut']['role']

const TOKEN = 'token'
export const getToken = (): string | null => localStorage.getItem(TOKEN)
export const setToken = (t: string | null): void => {
  if (t) localStorage.setItem(TOKEN, t)
  else localStorage.removeItem(TOKEN)
}

/** Called when the server rejects our token. Replaceable in tests. */
export const session = {
  redirect: (): void => {
    window.location.assign('/login')
  },
  expire: (): void => {
    setToken(null)
    session.redirect()
  },
}

export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown
  constructor(status: number, message: string, detail: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

type Body = Record<string, unknown> | FormData | URLSearchParams | undefined

const send = async (method: string, path: string, body?: Body): Promise<Response> => {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  let payload: BodyInit | undefined
  if (body instanceof FormData || body instanceof URLSearchParams) payload = body
  else if (body) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload })
  if (res.status === 401 && path !== '/auth/login') session.expire()
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { detail?: unknown } | null
    const d = data?.detail
    const message =
      typeof d === 'string' ? d : typeof d === 'object' && d && 'message' in d ? String(d.message) : res.statusText
    throw new ApiError(res.status, message, d)
  }
  return res
}

const json = async <T>(method: string, path: string, body?: Body): Promise<T> =>
  (await (await send(method, path, body)).json()) as T

export const get = <T>(path: string): Promise<T> => json<T>('GET', path)
export const post = <T>(path: string, body?: Body): Promise<T> => json<T>('POST', path, body)
export const put = <T>(path: string, body: Body): Promise<T> => json<T>('PUT', path, body)
export const del = <T>(path: string): Promise<T> => json<T>('DELETE', path)

/** Download a file through the authenticated API. */
export const download = async (path: string, filename: string): Promise<void> => {
  const url = URL.createObjectURL(await (await send('GET', path)).blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

export const qs = (params: Record<string, string>): string => {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v))
  return p.size ? `?${p.toString()}` : ''
}

const RANK: Record<Role, number> = { translator: 1, reviewer: 2, admin: 3 }
export const can = (user: S['UserOut'] | null | undefined, min: Role): boolean => !!user && RANK[user.role] >= RANK[min]
