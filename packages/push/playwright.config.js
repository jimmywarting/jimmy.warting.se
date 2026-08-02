import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PORT || 8787

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  // These tests drive real, headed, focus-stealing browser windows against
  // live push services - running more than one at a time on the same
  // machine causes focus/timing flakiness, so force them to run serially.
  workers: 1,
  retries: 0,
  reporter: [['list']],
  webServer: {
    command: 'node demo/server.js',
    url: `http://localhost:${PORT}/api/vapid-public-key`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe'
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure'
  },
  // Real Web Push delivery requires talking to the browser vendor's actual
  // push service (FCM for Chromium, Mozilla's autopush for Firefox). The
  // browsers Playwright downloads for you (`chromium`, `firefox`, `webkit`)
  // are unbranded/dev builds that ship without the API keys needed for that
  // registration step, so `pushManager.subscribe()` never resolves on them.
  // We therefore only run this suite against real, installed browsers via
  // Playwright's `channel` option.
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' }
    },
    {
      name: 'msedge',
      use: { ...devices['Desktop Chrome'], channel: 'msedge' }
    }
  ]
})
