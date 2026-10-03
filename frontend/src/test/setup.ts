import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './server'

// Node's fetch needs absolute URLs; the app calls relative `/api/...` paths.
const nativeFetch = globalThis.fetch
globalThis.fetch = (input, init) =>
  nativeFetch(typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input, init)

beforeAll(() => {
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
