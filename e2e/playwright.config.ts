import { defineConfig, devices } from '@playwright/test'

/**
 * Two projects:
 *  - api   : full stack (Rust axum + PostgreSQL) serving the built frontend on :8099
 *  - static: the same build as a pure static bundle (GitHub Pages mode) on :8098
 * Both are expected to be up already (npm run stack / scripts/serve_static.py).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'api',
      testMatch: /api-mode\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:8099' },
    },
    {
      name: 'static',
      testMatch: /static-mode\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:8098' },
    },
  ],
})
