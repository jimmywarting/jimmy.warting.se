This is a library to help you out with 
- Generating vapid keys
- Encrypt messages all on the client side for trully end-to-end encryption where not even your server
  can snoop on what the user is doing.
  - If you would like to send push messages from NodeJS on backend use [web-push] instead, this uses browsers own web crypto that NodeJS dose not have
- And generating [Request]-like object that can be used with fetch, node-fetch, axois or whatever
  this is not tied to any specific http library, you should send the request


```js
/** 
 * This was generated by calling
 * EncryptionHelperAES128GCM.generateB64ServerKeys()
 * 
 * The publicKey is used for when you subscribe to push `pushMananger.subscribe({ publicKey })`
 */
const APPLICATION_KEYS = {
  publicKey: 'BLZJC1yGe7p0eossH6xYpz2rhhmd_hQ8lRuh6qk2pY5fsUO-fON58k4a2LYFLzO0kejGr-DnDaucAKUVs1aq1W4',
  privateKey: 'AhGCHvOXbSgA_HTEFmVHowYwQlajvcbyKOFRYqsX3Bs',
}

// Import a web push encryption library when it's time to push messages
function lazzyImportPush() {
  return import('https://jimmy.warting.se/packages/webpush/encryption-aes128gcm.js')
    .then(({ default: EncryptionHelperAES128GCM }) =>
      new EncryptionHelperAES128GCM({
        vapidKeys: APPLICATION_KEYS,
        // contact information for push service to contact you
        // in case of problem. It's either a mailto: or https: link
        subject: 'https://jimmy.warting.se'
      })
    )
}

async function sendPushMessage (subscription, payloadText) {
  const uint8 = new TextEncoder().encode(payloadText)
  const encryptionHelper = await lazzyImportPush()

  // Return an array that can be passed to fetch as arguments
  const request = await encryptionHelper.getRequestDetails(
    subscription,
    uint8
  )

  // Cors support on a push services is a reasonable SHOULD requirement
  // https://github.com/w3c/push-api/issues/303

  // Curently only mozilla have CORS enabled.
  // So we can make request directly to them.
  if (request[0].includes('mozilla.com')) {
    return fetch(...request)
  }

  // As for the rest: pooke the bear and tell them to enable CORS support
  // In the meanwile we will have to use a CORS proxy - you should really build
  // your own proxy and not relly on anyone elses
  return sendRequestToProxyServer(...request)
}

// Used as a fallback if CORS is not enabled.
async function sendRequestToProxyServer(url, requestInfo) {
  // leave this up to you
}
```

[Request]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[web-push]: https://www.npmjs.com/package/web-push
