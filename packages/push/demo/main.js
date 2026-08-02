import { cors } from 'https://cors.jimmywarting.deno.net/cors.js'
import {
	unsubscribe,
	generateApplicationServerKeys,
	sendPushMessage,
	getSubscriptionOrSubscribe,
	getExistingSubscription
} from '../src/index.js'

/** @type {{ publicKey: string, privateKey: string }} */
let APPLICATION_KEYS = await (async function getOrSetApplicationKeysFromLocalStorage () {
	const keysJson = localStorage.getItem('vapidKeys')
	if (keysJson) {
		return JSON.parse(keysJson)
	} else {
		const keys = await generateApplicationServerKeys()
		localStorage.setItem('vapidKeys', JSON.stringify(keys))
		return keys
	}
})()

const statusEl = document.querySelector('#status')
const logEl = document.querySelector('#log')
const keysEl = document.querySelector('#keys')
const subscriptionEl = document.querySelector('#subscription')
const subscribeBtn = document.querySelector('#subscribe')
const unsubscribeBtn = document.querySelector('#unsubscribe')
const sendBtn = document.querySelector('#send')
const regenerateBtn = document.querySelector('#regenerate-keys')
const adminContactInput = document.querySelector('#admin-contact')
const payloadInput = document.querySelector('#payload')

function log (...args) {
  console.log(...args)
  const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
  logEl.value += `${line}\n`
  logEl.scrollTop = logEl.scrollHeight
}

function showSubscription (subscription) {
  subscriptionEl.value = subscription ? JSON.stringify(subscription.toJSON(), null, 2) : ''
  unsubscribeBtn.disabled = !subscription
  sendBtn.disabled = !subscription
}

async function main () {
  if (!('serviceWorker' in navigator) || !('PushManager' in globalThis) || !('Notification' in globalThis)) {
    statusEl.textContent = 'This browser does not support Web Push.'
    subscribeBtn.disabled = true
    return
  }

  const registration = await navigator.serviceWorker.register('./service-worker.js', {
		type: 'module'
	})

	await navigator.serviceWorker.ready

  navigator.serviceWorker.addEventListener('message', async (event) => {
    const bytes = await event.data.bytes()
    log('push received by service worker:', new TextDecoder().decode(bytes))
  })

  keysEl.value = JSON.stringify(APPLICATION_KEYS, null, 2)

  const subscription = await getExistingSubscription()
  statusEl.textContent = subscription
    ? 'Subscribed - ready to send a push message.'
    : 'Ready - click "Request permission & subscribe" to get started.'

	showSubscription(subscription)

  subscribeBtn.addEventListener('click', async () => {
    try {
      const subscription = await getSubscriptionOrSubscribe(APPLICATION_KEYS)
      showSubscription(subscription)
      statusEl.textContent = 'Subscribed - ready to send a push message.'
      log('subscribed:', subscription.toJSON())
    } catch (error) {
      statusEl.textContent = `Subscribe failed: ${error.message}`
      log('subscribe error:', error.message)
    }
  })

  unsubscribeBtn.addEventListener('click', async () => {
    await unsubscribe()
    showSubscription()
    statusEl.textContent = 'Unsubscribed.'
  })

  regenerateBtn.addEventListener('click', async () => {
		const keys = await generateApplicationServerKeys()
		APPLICATION_KEYS = keys
		localStorage.setItem('vapidKeys', JSON.stringify(keys))
		keysEl.value = JSON.stringify(keys, null, 2)
		log('regenerated application server keys')
		unsubscribe()
		statusEl.textContent = 'Unsubscribed.'
		showSubscription()
  })

  sendBtn.addEventListener('click', async () => {
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return

    sendBtn.disabled = true
    try {
			const res = await sendPushMessage({
				applicationServerKeys: APPLICATION_KEYS,
				payload: payloadInput.value,
				target: subscription,
				adminContact: adminContactInput.value,
				ttl: 60,
				urgency: 'high',
			})

			const result = await res.text()
			log('send-push result:', res.ok ? 'OK' : 'FAIL', res.status, result)
			const headers = JSON.parse(res.headers.get('x-adv-cors-original-response-headers'))
			log(JSON.stringify(Object.fromEntries(headers || res.headers), null, 2))
		} catch (error) {
			log('send-push error:', error.message)
		} finally {
			sendBtn.disabled = false
		}
  })
}

main()
