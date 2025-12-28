# PageLifecycle

`PageLifecycle` is a small utility that exposes the browser page lifecycle as an **Observable**.

It normalizes multiple browser events (`visibilitychange`, `focus`, `pagehide`, `freeze`, etc.) into a **single, consistent state machine**, making it easy to react to how a page is being used, backgrounded, frozen, or terminated.

This is especially useful for **offline-first apps**, **media playback**, **P2P / realtime apps**, and any application that needs accurate lifecycle awareness.

---

## States

| State        | Description                                    |
| ------------ | ---------------------------------------------- |
| `active`     | Page is visible and has focus                  |
| `passive`    | Page is visible but does not have focus        |
| `hidden`     | Page is not visible                            |
| `frozen`     | Page has been frozen by the browser            |
| `terminated` | Page is unloading or being navigated away from |

> **Note:** These states are designed to **mirror the Service Worker `Client.activeState` enums** (`active`, `idle`, `hidden`, etc.) as closely as possible. This makes it easier to keep your SW and page logic consistent.

---

## How it works

* Extends `Observable`
* Lifecycle logic is injected directly via `super(...)`
* A single generic event listener handles all lifecycle events
* State is derived from browser primitives (`document.visibilityState`, `document.hasFocus()`)
* Emits **only when the state actually changes**
* Cleanup is handled via **AbortSignal**
* Attempts to align with **Service Worker client states**

---

## Current state

The **current lifecycle state** is always available synchronously via the `state` property.

```js
pageLifecycle.state
```

This allows you to:

* read the lifecycle state without subscribing
* initialize logic based on the current state
* safely combine imperative and reactive code

Example:

```js
if (lifecycle.state === 'active') {
  start()
}
```

---

## Example

### Basic usage (ESM via URL)

```js
import { PageLifecycle } from 'https://jimmy.warting.se/packages/packages/page-lifecycle/index.js'

const lifecycle = new PageLifecycle()

lifecycle.subscribe(({ oldState, newState }) => {
  console.log(`${oldState} → ${newState}`)
})
```

---

### Pause / resume logic

```js
lifecycle.subscribe(({ newState }) => {
  if (newState === 'hidden' || newState === 'frozen') {
    pause()
  }

  if (newState === 'active') {
    resume()
  }
})
```

---

## Cleanup (AbortSignal)

`PageLifecycle` does **not** provide an `unsubscribe()` method.

Instead, cleanup is controlled using an **AbortSignal**, which is forwarded to all internal event listeners.

```js
const controller = new AbortController()

lifecycle.subscribe(
  ({ newState }) => {
    console.log(newState)
  },
  { signal: controller.signal }
)

// later
controller.abort()
```

When the signal is aborted:

* all internal event listeners are removed
* no further lifecycle events are emitted

---

## Design goals

* Observable-first API
* AbortSignal-based lifecycle control
* No polling
* No duplicate emissions
* Minimal overhead
* Browser-native lifecycle semantics
* **Mirrors Service Worker `Client.activeState` enums**

---

## Further reading & tips to avoid tab freezing

Tab freezing is controlled by the browser (especially Chrome) to save CPU and battery. There are some resources and techniques that can help you understand or **potentially reduce freezing**:

* [Chrome Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) – official docs on page lifecycle events
* `chrome://discards/` – inspect why tabs may be frozen; hints: active audio, WebRTC, WebSocket, Web Push
* [How Chrome's Tab Freezing Saves CPU & Battery](https://www.thefastcode.com/en-idr/article/how-chrome-s-tab-freezing-will-save-cpu-and-battery) – article explaining Chrome's logic
* `chrome://site-engagement/` – increase site engagement score (set to 100) to indicate frequent use
* Installing the page as a **PWA** can help; configure the app to **allow background processes** and disable battery-saver restrictions
* https://www.itechtics.com/disable-tab-throttling/
* 
> ⚠️ Note: These are **hints** and cannot guarantee a tab will never be frozen; browsers ultimately control freezing policies.

---

## Export

The module uses **named exports**.

```js
export { PageLifecycle }
```
