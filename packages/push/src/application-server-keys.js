/** @type {EcKeyGenParams & EcKeyImportParams} */
const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' }

/**
 * Generate VAPID application server keys as compact base64url strings.
 *
 * Persist the returned object as-is (JSON) and reuse it for every
 * `generatePushHTTPRequest` call.
 *
 * @returns {Promise<{ publicKey: string, privateKey: string }>}
 */
async function generateApplicationServerKeys () {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    ALGORITHM,
    true,
    ['sign', 'verify']
  )

  const [publicKeyBytes, privateKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('raw', publicKey),
    crypto.subtle.exportKey('jwk', privateKey)
  ])

  return {
    // Uncompressed P-256 public key (65 bytes, starts with 0x04)
    publicKey: new Uint8Array(publicKeyBytes).toBase64({
      alphabet: 'base64url',
      omitPadding: true
    }),
    // 32-byte private scalar (`d`) from the EC JWK
    privateKey: privateKeyJwk.d
  }
}

export {
  generateApplicationServerKeys
}