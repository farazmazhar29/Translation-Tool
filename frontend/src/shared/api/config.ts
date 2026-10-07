import axios, { AxiosError, type AxiosResponse } from 'axios'
import { Configuration } from './generated'
import { getToken, session } from './session'

/** An error answer of the API, with the server's own message ("Benutzername ist bereits vergeben"). */
export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown
  constructor(status: number, message: string, detail: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

/** FastAPI puts the reason into `detail`: a sentence, or an object with a `message` (duplicates, validation). */
const messageOf = (detail: unknown, fallback: string): string =>
  typeof detail === 'string'
    ? detail
    : typeof detail === 'object' && detail && 'message' in detail
      ? String(detail.message)
      : fallback

/** A file answer (Blob); `instanceof Blob` fails for a Blob from another realm (jsdom, iframes). */
const isFile = (data: unknown): data is Blob => Object.prototype.toString.call(data) === '[object Blob]'

/** FileReader instead of `blob.text()`, which not every environment has (jsdom). */
const readText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '') // readAsText always gives a string
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('unreadable'))
    }
    reader.readAsText(blob)
  })

const detailOf = async (data: unknown): Promise<unknown> => {
  // a failed download arrives as a file, since the request asked for one
  const body: unknown = isFile(data) ? JSON.parse(await readText(data)) : data
  return typeof body === 'object' && body && 'detail' in body ? body.detail : undefined
}

// Every generated API uses the default axios instance, so these two interceptors apply to all backend calls.
axios.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
axios.interceptors.response.use(undefined, async (error: unknown) => {
  if (!(error instanceof AxiosError) || !error.response) throw error // no answer at all (offline): as it is
  const response: AxiosResponse<unknown> = error.response
  const { status, statusText, data } = response
  if (status === 401 && !error.config?.url?.endsWith('/auth/login')) session.expire() // a wrong password is no 401 of the session
  const detail = await detailOf(data).catch(() => undefined)
  throw new ApiError(status, messageOf(detail, statusText), detail)
})

/** Passed to every generated factory, like `ProjectsApiFactory(API_CONFIG)`. The paths already start with /api. */
export const API_CONFIG = new Configuration({ basePath: '' })

/** Saves a file the API sent; the request must ask for `{ responseType: 'blob' }`. */
export const saveFile = async (request: Promise<AxiosResponse<unknown>>, filename: string): Promise<void> => {
  const { data } = await request
  const url = URL.createObjectURL(isFile(data) ? data : new Blob([JSON.stringify(data)]))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

/** As a file, not as JSON: the option for download calls. */
export const AS_FILE = { responseType: 'blob' } as const
