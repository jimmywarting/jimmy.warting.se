/**
 * Web Push message encryption - RFC 8291 ("Message Encryption for Web Push")
 * layered on top of the `aes128gcm` HTTP content coding from RFC 8188.
 *
 * Entirely Web Crypto based: ECDH for the key agreement, HKDF (SHA-256) for
 * key derivation and AES-128-GCM for the actual encryption.
 */

const encoder = new TextEncoder()

const MAX_RECORD_SIZE = 4096
// delimiter octet (1 byte) + AES-GCM authentication tag (16 bytes)
const RECORD_OVERHEAD = 17

/** Concatenate any number of byte arrays into one. */
function concatBytes (...arrays) {
  const length = arrays.reduce((total, array) => total + array.length, 0)
  const out = new Uint8Array(length)

  let offset = 0
  for (const array of arrays) {
    out.set(array, offset)
    offset += array.length
  }

  return out
}

/** HKDF (SHA-256) extract-and-expand in a single Web Crypto call. */
async function hkdf (inputKeyMaterial, salt, info, lengthInBytes) {
  const key = await crypto.subtle.importKey('raw', inputKeyMaterial, 'HKDF', false, ['deriveBits'])

  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    lengthInBytes * 8
  )

  return new Uint8Array(bits)
}

/**
 * Encrypt a push message payload for a given subscriber.
 *
 * @param {string | Uint8Array} payload
 * @param {object} subscriberKeys
 * @param {Uint8Array} subscriberKeys.p256dh Subscriber's ECDH public key (raw, 65 bytes).
 * @param {Uint8Array} subscriberKeys.auth Subscriber's 16 byte authentication secret.
 * @returns {Promise<Uint8Array>} The `aes128gcm` encoded body: header + ciphertext.
 */
export async function encryptPayload (payload, { p256dh: uaPublicKeyBytes, auth: authSecret }) {
  const plaintext = typeof payload === 'string' ? encoder.encode(payload) : payload

  if (plaintext.length + RECORD_OVERHEAD > MAX_RECORD_SIZE) {
    throw new RangeError(`Payload is too large - it must fit in a single ${MAX_RECORD_SIZE} byte record`)
  }

  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // Fresh, single-use ECDH key pair for this message.
  const applicationServerEcdhKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )

  const asPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', applicationServerEcdhKeys.publicKey)
  )

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaPublicKey },
      applicationServerEcdhKeys.privateKey,
      256
    )
  )

  // RFC 8291 section 3.4 - combine the ECDH shared secret with the
  // subscriber's auth secret to get the input key material for the
  // aes128gcm derivation below.
  const keyInfo = concatBytes(
    encoder.encode('WebPush: info\0'),
    uaPublicKeyBytes,
    asPublicKeyBytes
  )
  const inputKeyMaterial = await hkdf(sharedSecret, authSecret, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))

  const contentEncryptionKey = await hkdf(
    inputKeyMaterial,
    salt,
    encoder.encode('Content-Encoding: aes128gcm\0'),
    16
  )
  const nonce = await hkdf(
    inputKeyMaterial,
    salt,
    encoder.encode('Content-Encoding: nonce\0'),
    12
  )

  // Single record message: content || padding delimiter (0x02 = last record).
  const record = concatBytes(plaintext, new Uint8Array([2]))

  const aesKey = await crypto.subtle.importKey('raw', contentEncryptionKey, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record)
  )

  // RFC 8188 header: salt(16) || record size(4, big endian) || key id length(1) || key id
  const header = new Uint8Array(16 + 4 + 1 + asPublicKeyBytes.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, MAX_RECORD_SIZE)
  header[20] = asPublicKeyBytes.length
  header.set(asPublicKeyBytes, 21)

  return concatBytes(header, ciphertext)
}
