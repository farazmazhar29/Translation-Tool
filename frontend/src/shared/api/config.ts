import axios, { AxiosError, type AxiosResponse } from 'axios'
import i18n from 'i18next'
import { de as commonTexts } from '../i18n/common'
import { Configuration } from './generated'
import { getToken, session } from './session'

/** The API's error codes, each with a text in `common:errors` ("username_taken" → "Benutzername existiert bereits."). */
type ErrorCode = keyof typeof commonTexts.errors
const isErrorCode = (code: unknown): code is ErrorCode => typeof code === 'string' && code in commonTexts.errors

/**
 * The message of an error code in the interface's language, else the server's own (English) text. Also for codes
 * the API stores, like the error of a failed translation job.
 */
export const errorText = (code: unknown, params: Record<string, unknown>, fallback: string): string =>
  isErrorCode(code) ? i18n.t(`common:errors.${code}`, params) : fallback

/** An error answer of the API; the message is the text for its `code` in the interface's language. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown
  readonly code: string
  constructor(status: number, message: string, detail: unknown, code = '') {
    super(message)
    this.status = status
    this.detail = detail
    this.code = code
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

interface ErrorBody {
  detail?: unknown
  code?: unknown
  params?: unknown
}

const bodyOf = async (data: unknown): Promise<ErrorBody> => {
  // a failed download arrives as a file, since the request asked for one
  const body: unknown = isFile(data) ? JSON.parse(await readText(data)) : data
  return typeof body === 'object' && body ? body : {}
}

const paramsOf = (params: unknown): Record<string, unknown> =>
  typeof params === 'object' && params ? { ...params } : {}

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
  const { detail, code, params } = await bodyOf(data).catch((): ErrorBody => ({}))
  const message = errorText(code, paramsOf(params), messageOf(detail, statusText))
  throw new ApiError(status, message, detail, typeof code === 'string' ? code : '')
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
