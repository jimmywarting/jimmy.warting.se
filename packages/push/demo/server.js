// Tiny demo server - dev tooling only (not part of the shipped webpush
// module, so node: built-ins are fine here). Serves the static demo files
// and plays the role of the "application server": it owns the VAPID
// key pair and is the one actually sending push messages,
// exactly like a real backend would (this sidesteps the CORS restrictions
// push services impose on browser-side `fetch`).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const port = Number(process.env.PORT) || 8787

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon'
}

async function serveStatic (req, res, pathname) {
  const filePath = normalize(join(root, pathname))

  if (!filePath.startsWith(root)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  try {
    const stats = await stat(filePath)
    if (!stats.isFile()) throw new Error('not a file')

    const body = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
      // No caching, so the demo always reflects the latest source, and a
      // valid scope for the service worker.
      'Cache-Control': 'no-store',
      'Service-Worker-Allowed': '/'
    })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)

  // Redirect to /demo/ (rather than transparently serving demo/index.html at
  // "/") so the document's base URL - and therefore every relative import,
  // <script src>, and serviceWorker.register() call in the demo - resolves
  // against /demo/ instead of the site root.
  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/demo/' })
    res.end()
    return
  }

  const pathname = decodeURIComponent(url.pathname) === '/demo/'
    ? '/demo/index.html'
    : decodeURIComponent(url.pathname)

  await serveStatic(req, res, pathname)
})

server.listen(port, () => {
  console.log(`demo running at http://localhost:${port}`)
})
