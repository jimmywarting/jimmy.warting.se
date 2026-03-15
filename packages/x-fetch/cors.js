/**
 * @param {string | URL} url
 * @param {RequestInit} init 
 * @param {Object} [extra]
 * @param {string} [extra.method] Override HTTP method to use when making the request to the target URL. Defaults to the method of the incoming request.
 * @param {string} [extra.body] Override body to use when making the request to the target URL. Defaults to the body of the incoming request.
 * @param {string} [extra.status] Override the status code to use when responding to the client. Defaults to the status code of the response from the target URL.
 * @param {string} [extra.statusMessage] Override the status message to use when responding to the client. Defaults to the status message of the response from the target URL.
 * @param {boolean} [extra.forwardRequestHeaders=true] Whether to forward the request headers to the target URL. Defaults to true.
 * @param {boolean} [extra.setStatusCode] Whether to set the status code of the response to the status code of the response from the target URL. Defaults to reflect.
 * @param {string} [extra.setStatusMessage] Whether to set the status message of the response to the status message of the response from the target URL. Defaults to reflect.
 * @param {boolean} [extra.forwardIpAddress] Whether to forward the IP address of the client to the target URL. Defaults to true.
 * @param {HeadersInit} [extra.appendRequestHeaders] append additional request headers to the request sent to the target URL. Defaults to none.
 * @param {string[]} [extra.deleteRequestHeaders] Delete request headers from the request sent to the target URL. Defaults to none.
 * @param {HeadersInit} [extra.setRequestHeaders] Set request headers to the request sent to the target URL. This will overwrite any existing headers with the same name. Defaults to none.
 * @param {HeadersInit} [extra.appendResponseHeaders] append additional response headers to the response sent back to the client. Defaults to none.
 * @param {string[]} [extra.deleteResponseHeaders] Delete response headers from the response sent back to the client. Defaults to none.
 * @param {HeadersInit} [extra.setResponseHeaders] Set response headers to the response sent back to the client. This will overwrite any existing headers with the same name. Defaults to none.
 * @returns {Promise<Response>}
 */
async function cors(url, init = {}, extra = {}) {
  const q = new URLSearchParams({
    cors: JSON.stringify({
      url,
      ...extra
    })
  })
  
  url = 'https://adv-cors.deno.dev/?' + q
  
  const response = await fetch(url, init)

  return response
}

export {
  cors
}
