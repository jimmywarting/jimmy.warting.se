/// <reference lib='WebWorker' />

const workerSelf = /** @type ServiceWorkerGlobalScope */ (
	/** @type unknown */ (self)
)

workerSelf.addEventListener('install', function (evt) {
	evt.waitUntil(workerSelf.skipWaiting())
})

workerSelf.addEventListener('activate', function (evt) {
	evt.waitUntil(workerSelf.clients.claim())
})

workerSelf.addEventListener('push', function (evt) {
	console.log('received push event', evt)
  // Deliberately use `evt.data?.blob()` instead of `evt.data?.json()` or
  // `evt.data?.text()` to avoid any assumptions about the payload format. The
  // demo server sends a raw byte array, which is not valid JSON or UTF-8 text.
	const blob = evt.data?.blob()

	evt.waitUntil((async () => {
		const clients = await workerSelf.clients.matchAll({ includeUncontrolled: true })

		for (const client of clients) {
			client.postMessage(blob)
		}
	})())
})