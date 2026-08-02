# push

A dependency-free JS module for sending [Web Push](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
notifications, built entirely on standard Web APIs:

- **Web Crypto** (`crypto.subtle`) for ECDH, ECDSA, HKDF and AES-128-GCM - no polyfills, no `node:crypto`.
- The new [`Uint8Array.fromBase64()` / `Uint8Array#toBase64()`](https://github.com/tc39/proposal-arraybuffer-base64)
  methods for base64, with an option to pick the web-safe alphabet and whether to keep the `=` padding.
- `fetch`-ready output - `generatePushHTTPRequest()` just returns a `{ url, method, headers, body }` object.

It implements:

- [RFC 8291](https://www.rfc-editor.org/rfc/rfc8291) - Message Encryption for Web Push (`aes128gcm`)
- [RFC 8292](https://www.rfc-editor.org/rfc/rfc8292) - VAPID for Web Push
- [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030) - The Web Push protocol

No `node:` or npm dependencies are used anywhere in `src/` - it runs unmodified in any modern browser
and equally well in a Node.js (or Deno/Bun) backend, since both expose Web Crypto and the same
`Uint8Array` methods.

## Usage

```js
import * as push from 'https://jimmy.warting.se/packages/push/src/index.js'
import { generateApplicationServerKeys, generatePushHTTPRequest } from './src/index.js'

// Generate once, persist the returned JSON, and reuse across requests.
const applicationServerKeys = await generateApplicationServerKeys()

// Give the public key to the browser so it can subscribe:
// registration.pushManager.subscribe({
//   userVisibleOnly: true,
//   applicationServerKey: Uint8Array.fromBase64(applicationServerKeys.publicKey, {
//     alphabet: 'base64url',
//     lastChunkHandling: 'loose'
//   })
// })

const { url, method, headers, body } = await generatePushHTTPRequest({
  applicationServerKeys,
  // string or Uint8Array - omit entirely for an empty "tickle" push
  payload: 'Hello from webpush!',
  // a PushSubscription, or its .toJSON()/JSON shape
  target: subscription,
  // mailto: or https: contact for the push service to reach you about this message
  adminContact: 'mailto:you@example.com',
  ttl: 60,
  urgency: 'normal'
})

const response = await fetch(url, { method, headers, body })
```

> **Note:** Push services generally don't send CORS headers on their delivery endpoint, so the
> `fetch` above must happen on a server, not in a browser tab (see the demo below for exactly this
> split: the browser subscribes, the server sends).

### Persisting VAPID keys

```js
const generated = await generateApplicationServerKeys()
localStorage.setItem('vapidKeys', JSON.stringify(generated))

const restored = JSON.parse(localStorage.getItem('vapidKeys'))
// restored shape:
// {
//   publicKey: 'BAxmrX2FAMLfM2SxV81N_8gAXJEuUUjJVPTRpl5GboIfSJhOySknIWAMukb3P5s9l52bvp2FnnaEX6b2RV2UokE',
//   privateKey: 'H0L1P2gEoPH5RIEVFmb2E3NWxEcYyjZWoVFiCVfHRuA'
// }
```

### Native base64 usage

```js
bytes.toBase64({ alphabet: 'base64' })
bytes.toBase64({ alphabet: 'base64url', omitPadding: true })

Uint8Array.fromBase64(str, { alphabet: 'base64', lastChunkHandling: 'loose' })
Uint8Array.fromBase64(str, { alphabet: 'base64url', lastChunkHandling: 'loose' })
```

### Browser helpers: subscribe / unsubscribe / send

A handful of small helpers wrap the `PushManager`/`fetch` boilerplate for use directly from a page:

```js
import {
  generateApplicationServerKeys,
  getExistingSubscription,
  getSubscriptionOrSubscribe,
  sendPushMessage,
  unsubscribe
} from './src/index.js'

// Requires navigator.serviceWorker.ready to have resolved first.
const applicationServerKeys = await generateApplicationServerKeys()

// Look up the current subscription without prompting for permission.
const subscription = await getExistingSubscription()

// Subscribe (this WILL prompt for Notification permission) - or reuse the
// existing subscription if there already is one. Best called from a user
// gesture (e.g. a click handler) so the permission prompt isn't blocked.
const subscription2 = await getSubscriptionOrSubscribe(applicationServerKeys)

// Build the request with generatePushHTTPRequest() *and* actually send it.
const response = await sendPushMessage({
  applicationServerKeys,
  payload: 'Hello from the browser!',
  target: subscription2,
  adminContact: 'mailto:you@example.com'
})

// Unsubscribe the current push subscription, if any.
await unsubscribe()
```

`sendPushMessage()` exists so a page can send a push **without a backend of its own**. Since push
services generally don't send CORS headers on their delivery endpoint, a plain `fetch()` from a
browser tab to e.g. Google FCM fails - `sendPushMessage()` works around this:

- If the code isn't running in a secure context (e.g. called from Node/a server), there's no
  browser CORS enforcement to begin with, so the request is sent directly.
- Mozilla's autopush service is currently the only push service that allows cross-origin requests,
  so `mozilla`-hosted endpoints are also sent directly.
- Everything else is routed through the public CORS proxy at
  [cors.jimmywarting.deno.net](https://cors.jimmywarting.deno.net) as a fallback.

> **Security note:** routing through a third-party CORS proxy means that proxy can see the push
> service URL, headers (including the VAPID JWT) and encrypted payload of every message you send
> this way. It's fine for demos/prototyping, but for a real deployment you should send from your
> own backend with `generatePushHTTPRequest()` + `fetch()` directly instead of relying on
> `sendPushMessage()`'s proxy fallback.

## Demo

A minimal, fully working, **client-only** demo lives in [`demo/`](./demo):

- `demo/server.js` (plain `node:http`) only serves the static demo files - it holds no keys and
  sends nothing.
- The **browser** (`demo/main.js`) does everything else: it generates/persists its own VAPID keys
  in `localStorage`, registers the service worker, subscribes via `getSubscriptionOrSubscribe()`,
  and sends the push itself with `sendPushMessage()` (using its built-in CORS proxy fallback, see
  above).

Run it with:

```sh
npm run demo
```

Then open <http://localhost:8787>, click **"Request permission & subscribe"**, and **"Send push"**.
The service worker logs the received (decrypted!) message straight back to the page.

## Testing

The flow is tested end-to-end with [Playwright](https://playwright.dev) against **real, installed**
Chrome and Edge - subscribing for real against Google's FCM / Microsoft's push service, sending a
real encrypted message from the browser (via `sendPushMessage()`), and asserting the service
worker actually receives and decrypts it.

```sh
npm test
```

Playwright's own bundled/"dev" Chromium, Firefox and WebKit builds are intentionally **not** used:
those unbranded builds ship without the API keys their vendor's real push service requires, so
`pushManager.subscribe()` never resolves on them. Real Safari and Firefox also can't be driven by
Playwright's automation protocol on top of an existing installation, so this suite covers the
Chromium-family browsers (`chrome`, `msedge`) that support both a real profile and `channel`-based
automation of the actual installed browser.
