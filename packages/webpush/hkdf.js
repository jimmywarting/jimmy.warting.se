import { HMAC } from './hmac.js'

class HKDF {
  #ikm
  #hmac

  /**
   * @param {ArrayBuffer} ikm
   * @param {ArrayBuffer} salt
   */
  constructor (ikm, salt) {
    this.#ikm = ikm
    this.#hmac = new HMAC(salt)
  }

  /**
   * @param {Uint8Array} info
   * @param {number} byteLength
   */
  async generate (info, byteLength) {
    const fullInfoBuffer = new Uint8Array(info.byteLength + 1)
    fullInfoBuffer.set(info, 0)
    fullInfoBuffer.set(new Uint8Array([1]), info.byteLength)

    const prk = await this.#hmac.sign(this.#ikm)
    const nextHmac = new HMAC(prk)
    const nextPrk = await nextHmac.sign(fullInfoBuffer)
    return nextPrk.slice(0, byteLength)
  }
}

export {
  HKDF
}