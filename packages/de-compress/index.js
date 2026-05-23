/**
 * Compresses the input using the specified method and returns a <Response> object with the compressed body.
 * @param {BodyInit} bodyInit - can be a string, ArrayBuffer, TypedArray, Blob, or ReadableStream
 * @param {string} method - compression method, e.g., 'deflate' or 'gzip'
 */
const compress (bodyInit, method = 'deflate') =>
  new Response(new Response(bodyInit).body.pipeThrough(new CompressionStream(method)))

/**
 * Decompresses the input using the specified method and returns a <Response> object with the decompressed body.
 * @param {BodyInit} bodyInit - can be a string, ArrayBuffer, TypedArray, Blob, or ReadableStream
 * @param {string} method - compression method, e.g., 'deflate' or 'gzip'
 */
const decompress (bodyInit, method = 'deflate') => 
  new Response(new Response(bodyInit).body.pipeThrough(new DecompressionStream(method)))

export {
  compress,
  decompress
}
