import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
  test: {
    environment: 'jsdom',
    restoreMocks: true, // spies never leak into the next test
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/api/schema.d.ts', 'src/test/**', 'src/main.tsx', 'src/**/*.test.{ts,tsx}'],
      reporter: ['text-summary', 'html'],
      // Guard against regressions. Pages are large screens covered by the Playwright suite, not by unit tests.
      thresholds: { lines: 40, statements: 40, functions: 30, branches: 30 },
    },
  },
})
