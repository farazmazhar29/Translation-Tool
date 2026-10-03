import { expect, test as base } from '@playwright/test'

// Negative tests (wrong password, forbidden action) make the browser log the failed request on purpose.
const EXPECTED = /Failed to load resource: the server responded with a status of (401|403|409|422|429)/

/**
 * Every test also fails on uncaught exceptions and on console errors/warnings. This is what turns a
 * Content-Security-Policy violation ("Refused to apply inline style ...") into a red test instead of a silent bug.
 */
export const test = base.extend<{ consoleGuard: undefined }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on('console', (m) => {
        if ((m.type() === 'error' || m.type() === 'warning') && !EXPECTED.test(m.text())) {
          problems.push(`${m.type()}: ${m.text()}`)
        }
      })
      page.on('pageerror', (e) => problems.push(`uncaught: ${e.message}`))
      await use(undefined)
      expect(problems, 'the browser console must stay clean').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
