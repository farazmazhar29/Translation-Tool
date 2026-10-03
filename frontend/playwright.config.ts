import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the *built* app served by the real backend, with the offline mock translator,
 * a throw-away SQLite database and their own port – never against a developer's running instance.
 * Needs `npm run build` first (`npm run e2e` does it).
 */
const PORT = 8765
// One fresh data directory per run; workers re-evaluate this file, so the path is shared through the environment.
const data = (process.env['E2E_DATA'] ??= mkdtempSync(join(tmpdir(), 'rotpunkt-e2e-')))

const venvPython = resolve('..', 'backend', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const python = existsSync(venvPython) ? venvPython : 'python'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests share one database
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    locale: 'de-DE', // the specs read the German texts
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Locally use the installed Edge (no browser download); CI uses Playwright's Chromium.
    channel: process.env['PW_CHANNEL'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `"${python}" -m uvicorn app.main:app --port ${String(PORT)}`,
    cwd: '../backend',
    url: `http://localhost:${String(PORT)}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      LLM_PROVIDER: 'mock',
      LLM_MIN_INTERVAL: '0',
      DATABASE_URL: `sqlite:///${data.replaceAll('\\', '/')}/e2e.db`,
      DATA_DIR: data,
    },
  },
})
