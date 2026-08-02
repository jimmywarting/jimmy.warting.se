const encoder = new TextEncoder()
const privateKeyCache = new Map()

function decodeBase64url (value) {
  return Uint8Array.fromBase64(value, {
    alphabet: 'base64url',
    lastChunkHandling: 'loose'
  })
}

function assertApplicationServerKeysShape (applicationServerKeys) {
  if (!applicationServerKeys || typeof applicationServerKeys !== 'object') {
    throw new TypeError('applicationServerKeys must be an object with publicKey/privateKey strings')
  }

  if (typeof applicationServerKeys.publicKey !== 'string' || typeof applicationServerKeys.privateKey !== 'string') {
    throw new TypeError('applicationServerKeys.publicKey and applicationServerKeys.privateKey must be strings')
  }
}

async function getSigningKey (applicationServerKeys) {
  assertApplicationServerKeysShape(applicationServerKeys)

  const cacheKey = `${applicationServerKeys.publicKey}.${applicationServerKeys.privateKey}`
  const cached = privateKeyCache.get(cacheKey)
  if (cached) return cached

  const publicKeyBytes = decodeBase64url(applicationServerKeys.publicKey)
  const privateKeyBytes = decodeBase64url(applicationServerKeys.privateKey)

  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 4) {
    throw new TypeError('applicationServerKeys.publicKey must be a 65-byte uncompressed P-256 point')
  }

  if (privateKeyBytes.length !== 32) {
    throw new TypeError('applicationServerKeys.privateKey must be a 32-byte P-256 private scalar')
  }

  const x = publicKeyBytes.slice(1, 33).toBase64({ alphabet: 'base64url', omitPadding: true })
  const y = publicKeyBytes.slice(33, 65).toBase64({ alphabet: 'base64url', omitPadding: true })

  const signingKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d: applicationServerKeys.privateKey,
      ext: true,
      key_ops: ['sign']
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  privateKeyCache.set(cacheKey, signingKey)
  return signingKey
}

/** base64url (no padding) encode a JSON-serializable value, for use inside a JWT. */
function base64urlJSON (value) {
  return encoder.encode(JSON.stringify(value)).toBase64({
    alphabet: 'base64url',
    omitPadding: true
  })
}

/** `sub` claims must be a `mailto:` or `https:` URL - add `mailto:` for a bare email. */
function normalizeContact (adminContact) {
  if (!adminContact) return undefined
  return /^[a-z]+:/i.test(adminContact) ? adminContact : `mailto:${adminContact}`
}

/**
 * Build the `Authorization: vapid t=..., k=...` header value (RFC 8292).
 *
 * @param {object} options
 * @param {{ publicKey: string, privateKey: string }} options.applicationServerKeys
 * @param {string} options.audience Origin (scheme + host) of the push service.
 * @param {string} [options.adminContact] `mailto:` or `https:` contact, sent as the `sub` claim.
 * @param {number} [options.ttl=12 * 60 * 60] How long, in seconds, the JWT should remain valid.
 */
export async function createVapidAuthorizationHeader ({
  applicationServerKeys,
  audience,
  adminContact,
  ttl = 12 * 60 * 60
}) {
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + ttl,
    sub: normalizeContact(adminContact)
  }

  const unsignedToken = `${base64urlJSON(header)}.${base64urlJSON(payload)}`
  const signingKey = await getSigningKey(applicationServerKeys)

  // Web Crypto's ECDSA signatures are already the raw r||s concatenation
  // (IEEE P1363 format) that JOSE/JWT expects - no DER conversion needed.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    encoder.encode(unsignedToken)
  )

  const jwt = `${unsignedToken}.${new Uint8Array(signature).toBase64({
    alphabet: 'base64url',
    omitPadding: true
  })}`
  return `vapid t=${jwt}, k=${applicationServerKeys.publicKey}`
}
