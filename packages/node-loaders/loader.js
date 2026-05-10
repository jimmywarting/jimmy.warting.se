import { isMainThread } from 'node:worker_threads'
import { resolveObjectURL } from 'node:buffer'
import { openSync, closeSync, fstatSync, readSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { register, registerHooks } from 'node:module'
import { openAsBlob } from 'node:fs'

globalThis.__moduleMap = {}

/**
 * Registrerar loadern automatiskt om filen körs med --import
 */
if (isMainThread) {
  const { port1, port2 } = new MessageChannel()

  register(import.meta.url, {
    parentURL: import.meta.url,
    data: { port: port2 },
    transferList: [port2]
  })

  registerHooks({
    load (url, context, nextLoad) {
      const { conditions, format, importAttributes } = context
      const type = importAttributes?.type
      const id = crypto.randomUUID()
      const source = `const data = await __moduleMap[id]; delete __moduleMap[id]; export default data;`

      if (type && url.startsWith('https:')) {
        __moduleMap[id] = fetch(url).then(res => {
          if (!res.ok) throw new Error(`Failed to fetch module: ${res.statusText}`)
          return type === 'stream' ? res.body : res[type]()
        })

        return { format, shortCircuit: true, source }
      } else if (type && url.startsWith('blob:')) {
        __moduleMap[id] = resolveObjectURL(url)[type]()

        return { format, shortCircuit: true, source }
      } else if (type && type !== 'json' && url.startsWith('file:')) {
        if (type === 'stream') {
          // most straightforward way to get a stream of a file in node,
          // better then converting a node:stream into a web stream...
          __moduleMap[id] = open(new URL(url)).then(handle => handle.createReadStream({ autoClose: true }))
          return { format, shortCircuit: true, source }
        } else if (type === 'blob') {
          __moduleMap[id] = openAsBlob(new URL(url))
          return { format, shortCircuit: true, source }
        }

        // Read into a _pure_ vanilla byte array - cuz i don't like nodejs buffer...
        const fd = openSync(new URL(url), 'r')
        const { size } = fstatSync(fd)
        const bytes = new Uint8Array(size)
        readSync(fd, bytes)
        closeSync(fd)

        switch (type) {
          case 'text':
            __moduleMap[id] = new TextDecoder().decode(bytes)
            break
          case 'arrayBuffer':
            __moduleMap[id] = bytes.buffer
            break
          case 'bytes':
            __moduleMap[id] = bytes
            break
          default:
            throw new TypeError(`Unsupported type: ${type}`)
        }

        return { format, shortCircuit: true, source }
      }

      return nextLoad(url, context, nextLoad)
    },
    resolve (specifier, context, nextResolve) {
      const { parentURL, importAttributes, conditions } = context
      const type = importAttributes?.type
      const url = new URL(specifier, parentURL)

      if (url.protocol === 'npm:') {
        nextSpecifier = nextSpecifier.href.slice(4)
        return nextResolve(nextSpecifier, context, nextResolve)
      } else if (!type && url.protocol === 'blob:') {
        if (!['application/javascript', 'text/javascript'].includes(blob.type.toLowerCase())) {
          throw new TypeError('Unsupported blob type: ' + blob.type + '. expected text/javascript MIME type.')
        }

        port1.postMessage({ blob, specifier: url.href })
      } else if (type && type !== 'json' && /^(https?|blob|file):/.test(url.href)) {
        return {
          format: 'module',
          shortCircuit: true,
          importAttributes: context.importAttributes,
          url: context.importAttributes.url || url.href,
        }
      }

      return nextResolve(url.href, context, nextResolve)
    }
  })
}

async function resolve(url, context, nextResolve) {
  if (url.startsWith('blob:')) {
    return {
      url,
      shortCircuit: true,
      format: 'module',
    }
  }

  return nextResolve(url, context)
}

async function initialize(data) {
  const { port } = data
  port.addEventListener('message', evt => {
    const { blob, specifier } = evt.data
    const q = map.get(specifier)
    if (q) {
      q.resolve(blob)
    } else {
      map.set(specifier, blob)
    }
  })
  port.start()
}

/**
 * --- LOAD HOOK ---
 * Genererar källkod baserat på resurstyp och protokoll.
 */
async function load(url, context, nextLoad) {
  const type = context.importAttributes.type
  if (type) return nextLoad(url, context)

  // Om ingen speciell typ är vald, låt Node hantera det (eller vår https-fetch för kod)
  if (url.startsWith('https://')) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch module: ${res.statusText}`)
    return {
      format: 'module',
      shortCircuit: true,
      source: await res.text()
    }
  } else if (url.startsWith('blob:')) {
    let blob = map.get(url)

    if (!blob) {
      const q = Promise.withResolvers()
      map.set(url, q)
      blob = await q.promise
    }

    const source = await blob.text()
    map.delete(url)

    return {
      format: 'module',
      shortCircuit: true,
      source,
    }
  }

  return nextLoad(url, context)
}

export {
  resolve,
  load,
  initialize,
}
