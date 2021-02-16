globalThis.addEventListener('push', async evt => {
  // Read the push message that was sent
  const payload = evt.data?.json()

  // Broadcast the message to all tabs
  globalThis.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage(payload))
  })
})
