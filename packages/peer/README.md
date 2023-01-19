How is it "perfect"?
This is how: https://blog.mozilla.org/webrtc/perfect-negotiation-in-webrtc

- This p2p uses a so called "polite" peer that rollsback on collision.<br>
  Should read the article to understand more.

- This p2p also adds a pre negotiated DataChannel with a predfined id to
  reduce sdp offer/answer. so it don't have to deal with on ondatachannel events 
  This channel is also used for further negotiation so that a signaling
  server isn't needed anymore
  
- This p2p add option to disable trickle so it can reduce the amount of
  roundtrip it needs to establish a p2p connection for the cost of
  slightly longer time it might take.<br>
  This gets set to true when a connection have been establish for faster
  futer negotiation needed events


unlike simple-peer this dose not have node specific stuff like Node streams,
buffer or EventEmitter. So in a since this is more plain lightweight

You might have to do more manual work but somethimes it's worth the effort to
reduce all un-needed bloated code that you don't use

```js
import Peer from 'https://jimmy.warting.se/packages/peer/perfect-negotiation.js'

const peer1 = Peer({ 
  polite: true, // the peer that says you go ahead I will rollback on colision
  trickle: true, // default
  signal // AbortSignal to stop all event listener and disconnect the peer
})

// only used to signal description and candidates to the other peer
// once a connection is establish the RTCDataChannel takes over and sends signals over it
// then you can usually disconnect any websocket connection once the `peer.ready` promise resolves
// 
// All the 'onnegotiationneeded' will be handled for you in our internal datachannel that's created by default
// So all the datachannels and tracks that gets added later will be handled automaticallyl by perfect negotiation
peer1.signalingPort.onmessage = ({ data }) => {
    peer2.signalingPort.postMessage(data)
}

peer2.signalingPort.onmessage = ({ data }) => {
    peer1.signalingPort.postMessage(data)
}

// Wait for both peers connection state to be connected
await peer1.ready
await peer2.ready

/** 
 * RTCDataChannel - You could use this channel  to send messages but it's
 * recommended that you create your own channel as this gets used for 
 * further negotiation events so it has it own logic
 *   peer.pc.createDataChannel(...)
 */
peer1.dc.onmessage = evt => console.log(evt.data)
peer1.dc.send('Hello from peer1')

peer2.dc.onmessage = evt => console.log(evt.data)
peer2.dc.send('Hello from peer2')
```
Useally only half of this code is required, this just demostrate how to use 2 peers in the same context and giving you a taste of how it works
