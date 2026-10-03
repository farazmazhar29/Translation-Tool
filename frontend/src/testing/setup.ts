import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import i18n from 'i18next'
import { afterAll, afterEach, beforeAll } from 'vitest'
import '../app/i18n'
import { server } from './server'

// Node's fetch needs absolute URLs; the app calls relative `/api/...` paths.
const nativeFetch = globalThis.fetch
globalThis.fetch = (input, init) =>
  nativeFetch(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init)

beforeAll(async () => {
  await i18n.changeLanguage('de') // the tests read the German texts
  server.listen({ onUnhandledRequest: 'error' }) // a test must declare every request it makes
})
afterEach(() => {
  server.resetHandlers()
  cleanup()
  localStorage.clear()
})
afterAll(() => {
  server.close()
})
