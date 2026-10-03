import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
  test: {
    environment: 'jsdom',
    restoreMocks: true, // spies never leak into the next test
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/shared/api/schema.d.ts', 'src/testing/**', 'src/app/main.tsx', 'src/**/*.test.{ts,tsx}'],
      reporter: ['text-summary', 'html'],
      // Guard against regressions. Pages are large screens covered by the Playwright suite, not by unit tests.
      thresholds: { lines: 55, statements: 55, functions: 45, branches: 48 },
    },
  },
})
