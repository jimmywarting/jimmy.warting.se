class HMAC {
  #ikm

  /** @param {ArrayBuffer} ikm */
  constructor (ikm) {
    this.#ikm = ikm
  }

  async sign (input) {
    const key = await crypto.subtle.importKey('raw', this.#ikm,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return crypto.subtle.sign('HMAC', key, input)
  }
}

export {
  HMAC
}