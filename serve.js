// Production server: wraps the built TanStack Start fetch handler in node:http.
// Run `pnpm build` first.
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"
import { Readable } from "node:stream"
import { fileURLToPath } from "node:url"
import app from "./dist/server/server.js"

const PORT = Number(process.env.PORT ?? 3000)
// Loopback only: the page exposes private work data.
const HOST = "127.0.0.1"
const CLIENT_DIR = fileURLToPath(new URL("./dist/client/", import.meta.url))

const MIME = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
}

// Blocks DNS rebinding: a hostile page whose domain resolves to 127.0.0.1
// would otherwise be same-origin with us and could read server functions.
const allowedHost = (host = "") => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)

async function serveStatic(pathname, res) {
  const file = normalize(join(CLIENT_DIR, decodeURIComponent(pathname)))
  if (!file.startsWith(CLIENT_DIR)) return false
  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) return false
  res.writeHead(200, {
    "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
    "Content-Length": info.size,
    // Vite fingerprints everything under /assets.
    "Cache-Control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
  })
  createReadStream(file).pipe(res)
  return true
}

function toRequest(req) {
  const url = `http://${req.headers.host}${req.url}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    }
    else if (value != null) headers.set(key, value)
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  })
}

const server = createServer(async (req, res) => {
  try {
    if (!allowedHost(req.headers.host)) {
      res.writeHead(403).end("forbidden")
      return
    }
    const { pathname } = new URL(req.url, "http://localhost")
    if (pathname !== "/" && (await serveStatic(pathname, res))) return

    const response = await app.fetch(toRequest(req))
    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      if (key !== "set-cookie") res.setHeader(key, value)
    })
    const cookies = response.headers.getSetCookie()
    if (cookies.length) res.setHeader("set-cookie", cookies)
    if (response.body) Readable.fromWeb(response.body).pipe(res)
    else res.end()
  } catch (err) {
    console.error(err)
    if (!res.headersSent) res.writeHead(500)
    res.end("internal error")
  }
})

server.listen(PORT, HOST, () => {
  console.log(`browser-home on http://localhost:${PORT}`)
  // Render once so the source caches are warm before the first real tab.
  fetch(`http://localhost:${PORT}/`).catch(() => {})
})
