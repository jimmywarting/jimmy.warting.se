// The default @playwright/test `context` fixture creates an *incognito*
// browser context. Chrome (and Edge) deliberately disable the Push API in
// incognito mode (crbug.com/1462471), so a real end-to-end push test needs a
// normal, persistent browser profile instead - hence this custom fixture.
import { test as base, chromium } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const test = base.extend({
  context: async ({}, use, testInfo) => {
    const { channel, headless } = testInfo.project.use

    const userDataDir = await mkdtemp(join(tmpdir(), 'webpush-playwright-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel,
      headless: headless ?? false
    })

    await use(context)

    await context.close()
    await rm(userDataDir, { recursive: true, force: true })
  },

  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? await context.newPage()
    await use(page)
  }
})

export { expect } from '@playwright/test'
