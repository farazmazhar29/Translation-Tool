import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
  build: {
    rollupOptions: {
      output: {
        // Libraries and the generated API client change rarely: in their own files the browser keeps them cached
        // when only the app changes (and no single file passes Vite's 500 kB warning).
        manualChunks: (id) =>
          id.includes('/src/shared/api/generated/') ? 'api' : id.includes('/node_modules/') ? 'vendor' : undefined,
      },
    },
  },
  test: {
    environment: 'jsdom',
    restoreMocks: true, // spies never leak into the next test
    testTimeout: 15_000, // typing into forms is slow on a busy machine; a timeout must mean "stuck", not "slow"
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/shared/api/generated/**', 'src/testing/**', 'src/app/main.tsx', 'src/**/*.test.{ts,tsx}'],
      reporter: ['text-summary', 'html'],
      // Guard against regressions. Pages are large screens covered by the Playwright suite, not by unit tests.
      thresholds: { lines: 55, statements: 55, functions: 45, branches: 48 },
    },
  },
})
