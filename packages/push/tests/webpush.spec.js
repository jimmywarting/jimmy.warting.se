import { test, expect } from './fixtures.js'

test.describe('webpush demo (real browser + real push service)', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.grantPermissions(['notifications'], { origin: baseURL })
  })

  test('subscribes and delivers an encrypted push message end-to-end', async ({ page }) => {
    await page.goto('/')

    // Wait for the demo to finish registering the service worker and
    // fetching the server's VAPID public key.
    await expect(page.locator('#public-key')).not.toHaveValue('', { timeout: 15_000 })
    await expect(page.locator('#subscribe')).toBeEnabled()

    await page.locator('#subscribe').click()

    // A real subscription requires reaching the browser vendor's push
    // service (FCM / autopush) over the network.
    await expect(page.locator('#subscription')).not.toHaveValue('', { timeout: 20_000 })

    const subscriptionJSON = await page.locator('#subscription').inputValue()
    const subscription = JSON.parse(subscriptionJSON)
    expect(subscription.endpoint).toMatch(/^https:\/\//)
    expect(subscription.keys.p256dh).toBeTruthy()
    expect(subscription.keys.auth).toBeTruthy()

    const message = `hello from playwright ${test.info().project.name} @ ${Date.now()}`
    await page.locator('#payload').fill(message)
    await page.locator('#send').click()

    // The demo sends the push itself, from the browser, via `sendPushMessage()`
    // (which builds the encrypted request, signs a VAPID JWT, and POSTs it
    // directly to the real push service, using a CORS proxy fallback where needed).
    await expect(page.locator('#log')).toContainText('send-push result: OK', { timeout: 20_000 })

    // The push service then forwards it to the browser, which wakes the
    // service worker; the worker relays the decrypted text back to the page.
    await expect(page.locator('#log')).toContainText(message, { timeout: 20_000 })
  })
})
