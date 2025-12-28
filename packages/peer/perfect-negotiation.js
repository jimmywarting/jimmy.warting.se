function waitToCompleteIceGathering(pc, eventOptions, state = pc.iceGatheringState) {
  if (state === 'complete') return
  const ctrl = new AbortController()
  const signals = AbortSignal.any([ eventOptions.signal, ctrl.signal ])
  const q = Promise.withResolvers()
  const completed = Symbol('completed')

  pc.addEventListener('icegatheringstatechange', () => {
    console.log(pc.iceGatheringState)
    if (pc.iceGatheringState === 'complete') {
      ctrl.abort(completed)
    }
  }, { signal: signals })

  signals.addEventListener('abort', () => {
    signals.reason === completed ? q.resolve() : q.reject(signals.reason)
  }, { once: true })

  return q.promise
}

/**
 * @typedef {AddEventListenerOptions} Test~options
 * @property {AbortSignal} signal - funkis?
 */

class Peer {
  /**
   * @param {{
   *   polite: boolean,
   *   trickle: boolean,
   *   iceServers: RTCIceServer[]
   *   signal: AbortSignal
   * }} [options]
   */
  constructor (options) {

    let { polite = true, trickle = true } = options || {}

    let { port1, port2 } = new MessageChannel()
    let send = msg => port2.postMessage(JSON.stringify(msg))

    const pc = new RTCPeerConnection({
      iceServers: options?.iceServers || [{
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:global.stun.twilio.com:3478'
        ]
      }]
    })

    const ctrl = new AbortController()

    /** @type {any} dummy alias for AbortSignal to make TS happy */
    const eventOptions = { signal: ctrl.signal }

    pc.addEventListener('iceconnectionstatechange', () => {
      if (
        pc.iceConnectionState == 'disconnected' ||
        pc.iceConnectionState === 'failed'
      ) {
        ctrl.abort()
      }
    }, eventOptions)

    const dc = pc.createDataChannel('both', { negotiated: true, id: 0 })

    this.pc = pc
    this.dc = dc
    this.signal = ctrl.signal
    this.polite = polite
    this.signalingPort = port1

    this.ready = new Promise((rs) => {
      dc.addEventListener('open', () => {
        // At this point we start to trickle over datachannel instead
        // we also close the message channel as we do not need it anymore
        trickle = true
        send = (msg) => dc.send(JSON.stringify(msg))
        port1.close()
        port2.close()
        port2 = port1 = port2.onmessage = null
        rs()
      }, { once: true, ...eventOptions })
    })

    pc.addEventListener('icecandidate', ({ candidate }) => {
      trickle && send({ candidate: candidate?.toJSON() || candidate })
    }, eventOptions)

    // The rest is the polite peer negotiation logic, copied from this blog

    let makingOffer = false, ignoreOffer = false

    pc.addEventListener('negotiationneeded', async () => {
      try {
        makingOffer = true
        const offer = await pc.createOffer()
        if (pc.signalingState != 'stable') return
        await pc.setLocalDescription(offer)
        makingOffer = false
        if (trickle) {
          send({ description: pc.localDescription?.toJSON() })
        } else {
          await waitToCompleteIceGathering(pc, eventOptions)
          const description = pc.localDescription.toJSON()
          description.sdp = description.sdp.replace(/a=ice-options:trickle.*\r?\n/g, '')
          send({ description })
        }
      } catch (_err) {/* */}
    }, eventOptions)

    const onmessage = async ({ data }) => {
      if (typeof data === 'string' && (data.includes('"description"') || data.includes('"candidate"'))) {
        try { data = JSON.parse(data) } catch (_err) {/**/}
      }

      if (data?.description) {
        const offerCollision = data.description.type == 'offer' &&
          (makingOffer || pc.signalingState != 'stable')

        ignoreOffer = !this.polite && offerCollision
        if (ignoreOffer) {
          return
        }

        if (offerCollision) {
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(data.description)
          ])
        } else {
            data.description.type === 'answer' && pc.signalingState === 'stable' ||
              await pc.setRemoteDescription(data.description).catch(() => {})
        }
        if (data.description.type === 'offer') {
          await pc.setLocalDescription(await pc.createAnswer())
          // Edge didn't set the state to 'new' after calling the above :[
          if (!trickle) await waitToCompleteIceGathering(pc, eventOptions, 'new')
          send({ description: pc.localDescription?.toJSON() })
        }
      } else if (data?.candidate) {
        await pc.addIceCandidate(data.candidate)
      }
    }

    port2.onmessage = onmessage
    dc.addEventListener('message', onmessage, eventOptions)
  }
}

export { Peer as default, Peer }

/* FOR TESTING
const p1 = new Peer({ polite: true, trickle: false })
const p2 = new Peer({ polite: false, trickle: false })

p1.signalingPort.onmessage = e => p2.signalingPort.postMessage(e.data)
p2.signalingPort.onmessage = e => p1.signalingPort.postMessage(e.data)

await Promise.all([p1.ready, p2.ready])

p1.dc.addEventListener('message', console.log)
p2.dc.send('hej')
*/
