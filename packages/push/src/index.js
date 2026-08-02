import { generateApplicationServerKeys } from './application-server-keys.js'
import { createVapidAuthorizationHeader } from './vapid.js'
import { encryptPayload } from './encrypt.js'

const VALID_URGENCIES = ['very-low', 'low', 'normal', 'high']

function isApplicationServerKeysObject (value) {
  return value &&
    typeof value === 'object' &&
    typeof value.publicKey === 'string' &&
    typeof value.privateKey === 'string'
}

/** Accept a `PushSubscription`, a `PushSubscriptionJSON`-shaped object, or the plain JSON. */
function normalizeTarget (target) {
  const subscription = typeof target.toJSON === 'function' ? target.toJSON() : target

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new TypeError('target must be a PushSubscription (or its JSON) with an endpoint and p256dh/auth keys')
  }

  return {
    endpoint: subscription.endpoint,
    p256dh: Uint8Array.fromBase64(subscription.keys.p256dh, {
      alphabet: 'base64url',
    }),
    auth: Uint8Array.fromBase64(subscription.keys.auth, {
      alphabet: 'base64url',
    })
  }
}

/**
 * Build a ready-to-`fetch` HTTP request that delivers a Web Push message to
 * a push service, per RFC 8030 (Web Push protocol), RFC 8291 (message
 * encryption) and RFC 8292 (VAPID).
 *
 * @param {object} options
 * @param {{ publicKey: string, privateKey: string }} options.applicationServerKeys VAPID identity key pair, see `generateApplicationServerKeys()`.
 * @param {string | Uint8Array} [options.payload] Optional message payload. Omit for an empty "tickle" push.
 * @param {PushSubscription | object} options.target The subscriber's `PushSubscription` (or its JSON).
 * @param {string} [options.adminContact] Contact email/URL sent to the push service (`sub` claim), e.g. `mailto:you@example.com`.
 * @param {number} [options.ttl=2419200] How long (seconds) the push service should try to deliver the message for.
 * @param {'very-low' | 'low' | 'normal' | 'high'} [options.urgency] Delivery urgency hint.
 * @param {string} [options.topic] Replaces any currently pending message with the same topic.
 * @returns {Promise<{ url: string, method: 'POST', headers: Record<string, string>, body: Uint8Array }>}
 */
async function generatePushHTTPRequest ({
  applicationServerKeys,
  payload,
  target,
  adminContact,
  ttl = 4 * 7 * 24 * 60 * 60,
  urgency,
  topic
}) {
  if (!isApplicationServerKeysObject(applicationServerKeys)) {
    throw new TypeError('applicationServerKeys must be an object with publicKey/privateKey strings')
  }

  if (!Number.isInteger(ttl) || ttl < 0) {
    throw new TypeError('ttl must be a non-negative integer (seconds)')
  }

  if (urgency !== undefined && !VALID_URGENCIES.includes(urgency)) {
    throw new TypeError(`urgency must be one of: ${VALID_URGENCIES.join(', ')}`)
  }

  const { endpoint, p256dh, auth } = normalizeTarget(target)

  const headers = { TTL: String(ttl) }

  if (urgency) headers.Urgency = urgency
  if (topic) headers.Topic = topic

  let body = new Uint8Array(0)

  if (payload != null) {
    body = await encryptPayload(payload, { p256dh, auth })
    headers['Content-Type'] = 'application/octet-stream'
    headers['Content-Encoding'] = 'aes128gcm'
  }

  headers['Content-Length'] = String(body.length)

  headers.Authorization = await createVapidAuthorizationHeader({
    applicationServerKeys,
    audience: new URL(endpoint).origin,
    adminContact
  })

  return { url: endpoint, method: 'POST', headers, body }
}

/**
 * Gets the existing push subscription or subscribes the user if none exists.
 *
 * Note that:
 * - This will prompt the user for permission if they haven't granted it yet.
 * - A registered & installed service worker is required for this to work.
 * - It's best used in a user gesture to avoid permission prompts being blocked.
 *
 * @param {{ publicKey: string }} keys The application server keys, see `generateApplicationServerKeys()`. Only `publicKey` is needed here.
 * @returns The existing, or newly created, subscription.
 */
async function getSubscriptionOrSubscribe (keys) {
  const sw = await navigator.serviceWorker.getRegistration()

  return await sw.pushManager.getSubscription() || sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.fromBase64(keys.publicKey, {
      alphabet: 'base64url'
    })
  })
}

/**
 * Get the current push subscription for this page's service worker, without
 * subscribing if there isn't one yet (unlike `getSubscriptionOrSubscribe`).
 *
 * Requires a registered & installed service worker (`navigator.serviceWorker.ready`).
 */
async function getExistingSubscription () {
  const sw = await navigator.serviceWorker.getRegistration()
  return sw.pushManager.getSubscription()
}

/**
 * Build a push message with `generatePushHTTPRequest()` and actually send it
 * with `fetch()` - including a CORS workaround for calling this directly
 * from a browser tab.
 *
 * Push services generally don't send CORS headers on their delivery
 * endpoint, so a plain `fetch()` from a browser fails. This helper works
 * around that:
 * - Outside of a secure context (e.g. called from Node/a server) there's no
 *   browser CORS enforcement to begin with, so the request is sent directly.
 * - Mozilla's autopush service is currently the only push service that
 *   allows cross-origin requests, so `mozilla` endpoints are also sent directly.
 * - Everything else (e.g. Google FCM, Microsoft's push service) is routed
 *   through the public CORS proxy as a fallback, so this also works for a
 *   client-only demo with no backend.
 *
 * For a real deployment, prefer sending from your own server with
 * `generatePushHTTPRequest()` + `fetch()` directly, rather than relying on a
 * third-party CORS proxy to relay your push requests.
 *
 * @param {Parameters<typeof generatePushHTTPRequest>[0]} options Same options as `generatePushHTTPRequest`.
 * @returns The push service's (or CORS proxy's) response.
 */
async function sendPushMessage (options) {
  const { url, ...init } = await generatePushHTTPRequest(options)

  // Mozilla is the only push service that allows CORS requests.
  //
  // A secure context is a indication that the request is coming from a browser,
  // Which means that the std fetch() has to follow CORS rules
  // (don't see any reason why servers would impl globalThis.isSecureContext)
  if (url.includes('mozilla') || !globalThis.isSecureContext) {
    return fetch(url, init)
  }

  const q = new URLSearchParams({
    cors: JSON.stringify({
      url,
      // This is required, otherwise we get this from google:
      // "x-goa-security-debug": "cross-origin request blocked by Goa's
      // sandboxed serving (see go/goa-http-serving#sandboxing for more
      // information)",
      deleteRequestHeaders: [ 'Origin', 'Sec-Fetch-Mode' ]
    })
  })

  return fetch('https://cors.jimmywarting.deno.net/?' + q, init)
}

/**
 * Unsubscribe this page's service worker from push, if it's currently subscribed.
 */
async function unsubscribe () {
  const sw = await navigator.serviceWorker.getRegistration()
  const subscription = await sw.pushManager.getSubscription()
  if (subscription) {
    await subscription.unsubscribe()
  }
}

export {
  generateApplicationServerKeys,
  generatePushHTTPRequest,
  getExistingSubscription,
  getSubscriptionOrSubscribe,
  sendPushMessage,
  unsubscribe
}