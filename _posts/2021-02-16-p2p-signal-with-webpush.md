---
layout: post
title: "Establish WebRTC connection without a signaling server using nothing but Web Push"
categories: p2p
---

Serverless technologies are great. And when you need to chat/talk to one or another, then you can do so directly with WebRTC. But what sucks is that you have to signal offer & answers back and forth using a server.

Imagine if you didn't have to use a server or some external third party WebSocket service? This is what I have attempted to solve using nothing but Web Push as a signaling technique.

<details>
  <summary>What I will go through</summary>
  <blockquote>
  - How you can use Web Push as a kind of "phone number" that you can "call" too
  - Setting up Service Worker to listen to push messages and broadcast them to all open tabs
  - Generating a VAPID public/private key
    - Using the keys to subscribe and encrypt payloads
  </blockquote>
</details>

<details>
  <summary>What I won't be cover</summary>
  <blockquote>
  - How to best request for notification permission and dealing with rejection.
  - How to get the other person's subscription
  - Having an "answer" or "hang up" option to choose from.
  - Showing any desktop notification and reacting to click event. (Yes, we are going to send silent push)
  - Or how to forward the push payload to the correct tab that is setting up the WebRTC peer connection
    - In this case it will be best that you only have one tab open on two browsers.

  This will mostly just only focus on just establish a p2p connection with WebRTC
  </blockquote>
</details>

<br>

First thing first. You are going to need a service worker that can handle push events<br>
Create a service worker and add the required event.

```js
// service-worker.js
globalThis.addEventListener('push', async evt => {
  // Read the push message that was sent
  const payload = evt.data.json()

  // Broadcast the message to all tabs
  globalThis.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage(payload))
  })
})
```

Then in our main thread we will need two libraries to help bootstrap the application
```js
// main.js
import Peer from 'https://jimmy.warting.se/packages/webrtc/perfect-negotiation.js'
import EncryptionHelperAES128GCM from 'https://jimmy.warting.se/packages/webpush/encryption-aes128gcm.js'

/*
  We are going to need some public/private keys to subscribe and encrypt messages
  you can generate your own with this:

  import('https://jimmy.warting.se/packages/webpush/encryption-aes128gcm.js')
    .then(m => m.default.generateB64ServerKeys())
    .then(JSON.stringify)
    .then(prompt.bind(null, 'Here is your keys'))
*/

const APPLICATION_KEYS = {
  publicKey: 'BLZJC...',
  privateKey: 'AhGCH...',
}

...
```
Then we are going to
- Initiate the encryption helper with our keys
- Set up the local peer
- And install the service worker

```js
...

const encryptionHelper = new EncryptionHelperAES128GCM({
  vapidKeys: APPLICATION_KEYS,
  // contact information for push service to contact you
  // in case of problem. It's either a mailto: or https: link
  subject: 'https://jimmy.warting.se'
})

/**
 * @params {PushSubsription|object} subscription
 * @params {string} text
 */
async function sendPushMessage (subscription, text) {
  const uint8 = new TextEncoder().encode(text)

  console.info('Sending push message', JSON.parse(text))

  // Returns an array that can be passed to fetch as arguments
  // Or reconstructed to work with xhr, axios, or whatever
  // Can also be used for sending the request through a CORS proxy
  const request = await encryptionHelper.getRequestDetails(
    subscription,
    uint8
  )

  return fetch(...request)
}

// we can create a WebRTC peer early so it have some time
// to gather ice candidates
const peer = new Peer({
  // We want to send as few push messages as needed
  // since push messages is costly and have a quota
  // on how many push messages you can send
  // (specially when sending silent push)
  trickle: false,

  // Both are going to start out as polite but first person to
  // receive a push message isn't going to be polite
  polite: true
})

// Install the service worker
navigator.serviceWorker.register('/service-worker.js')

// Listen for when a service worker is broadcasting a push event
navigator.serviceWorker.addEventListener('message', async evt => {
  const payload = evt.data
  const { subscription: caller, ...sdp } = payload

  console.info('Received a push payload', payload)

  // The first signal (push) message is going to have push subscription
  // from the sender that we (the receiver) can use when sending back messages
  if (caller) {
    peer.polite = false
    // Start listening for offer/answer signals
    peer.signalingPort.onmessage = ({ data }) => {
      sendPushMessage(caller, data)
    }
  }

  // Send the remaining sdp signal to the peer
  peer.signalingPort.postMessage(sdp)
})

...
```
Now when the service worker, peer and encryption helper is set up all and done
We will need to set up call to action
```js
...

button.onclick = async () => {
  if (Notification.permission !== 'granted') {
    await Notification.requestPermission()
  }

  const friendsSubscription = prompt(
    'Who would you like to call?',
    sessionStorage.lastSubscription
  )

  sessionStorage.lastSubscription = friendsSubscription

  // We are going to need our own subscription also
  // So we can tell our friend who is calling him and reply back
  let registration = await navigator.serviceWorker.ready
  let subscription =
    await registration.pushManager.getSubscription() ||
    await registration.pushManager.subscribe({
      userVisibleOnly: true, // a chrome requirement...
      applicationServerKey: APPLICATION_KEYS.publicKey
    })

  // Now that we have two subscription we can begin talking to each other
  peer.signalingPort.onmessage = ({ data }) => {
    // Embed our own push subscription into the first signal message
    // so that he or she can respond back
    data = ({ subscription, ...JSON.parse(data) })

    // Now send it via web push
    sendPushMessage(
      JSON.parse(friendsSubscription),
      JSON.stringify(data)
    )

    // It could be useful to always send my own subscription.
    // or some other form of identification as long the receiver
    // have a id<->subscription mapping but for the sake of simplicity
    // we will only deal with one p2p connection at the time
    // + a subscription can be quite lengthy and a push payload is farley
    // limited i guess. but i don't think the size is an issue.
    subscription = undefined
  }
}
```

### Demo Time

<pre id="yourSubscription"></pre>
<button hidden id="showMySubscription">Show my push subscription</button>
<button id="callButton">Call a friend</button>
<script type="module" src="/demos/webrtc-and-webpush/main.js"></script>

### summary

Knowing the other persons subscription requires some form of syncing but it only need to happen once. After that you can push messages to the other person how often you want. You can store this subscription in localStorage or however you like. I store the other persons subscription in SessionsStorage, so it's cleared when you close your browser. This is like a HTTP websocket upgrade request where you go from web push to start talking over WebRTC instead.

The bad parts is you will need the user consent to have this working. Most ppl don't like to enable desktop notification if you don't have a good UX/context of why it should be enabled. Remember don't ask for permission on page load, do it on any user interaction.

The 2nd part is that not all push services have enabled CORS support on there own push service. Only Mozilla do, This is a [reasonable SHOULD requirement](https://github.com/w3c/push-api/issues/303) to enable this kind of end-to-end p2p to start talking to each other without any involvement of server. not even your own! The push payload is also encrypted so there is no way for the push service to know what you are sending to the other person. I'm also using a CORS proxy service to send out push to the rest of browsers.
