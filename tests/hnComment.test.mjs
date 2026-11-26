import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, afterEach, before, mock, test } from "node:test"
import { createServer } from "vite"
import { insertComment } from "../src/lib/hn.ts"

let formatPlainComment
let postComment
let server
let cacheDir

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "hn-comment-test-"))
  server = await createServer({
    configFile: false,
    cacheDir,
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  })
  const mod = await server.ssrLoadModule("/src/server/hnComment.ts")
  formatPlainComment = mod.formatPlainComment
  postComment = mod.postComment
})

after(async () => {
  await server?.close()
  if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
})

const parentId = 50651547
const itemUrl = `https://news.ycombinator.com/item?id=${parentId}`
const cookie = "ndom91&test-session-token"
const hmac = "test-hmac-secret"

const itemPage = (extra = "") =>
  `<a id="me" href="user?id=ndom91">ndom91</a><a href="logout?auth=test">logout</a>` +
  `<form action="comment" method="post">` +
  `<input type="hidden" name="parent" value="${parentId}">` +
  `<input type="hidden" name="goto" value="item?id=${parentId}">` +
  `<input type="hidden" name="hmac" value="${hmac}">` +
  `<textarea name="text"></textarea>` +
  `<input type="submit" value="reply">` +
  `</form>${extra}`

const commentRow = (id, author, text, indent = 0) =>
  `<tr class="athing comtr" id="${id}"><td><table><tr><td class="ind" indent="${indent}"></td>` +
  `<td><a href="user?id=${author}">${author}</a>` +
  `<div class="comment"><div class="commtext c00">${text}<div class="reply"></div></div></div>` +
  `</td></tr></table></td></tr>`

afterEach(() => mock.restoreAll())

test("fetches hmac, posts form with session cookie, and resolves new comment id", async () => {
  const calls = []
  mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url: String(url), options })
    if (calls.length === 1) return new Response(itemPage(commentRow(50651600, "ndom91", "Older reply")))
    if (calls.length === 2) return new Response(null, { status: 302, headers: { Location: `item?id=${parentId}` } })
    return new Response(
      itemPage(
        commentRow(50651600, "ndom91", "Older reply") +
          commentRow(50651999, "ndom91", "Least privilege helps.<p>Second paragraph.<script>bad()</script>"),
      ),
    )
  })

  const comment = await postComment(parentId, "Least privilege helps.\n\nSecond paragraph.", cookie)
  assert.equal(comment.id, 50651999)
  assert.equal(comment.author, "ndom91")
  assert.equal(comment.isYou, true)
  assert.equal(comment.html, "Least privilege helps.<p>Second paragraph.bad()")
  assert.deepEqual(comment.children, [])

  assert.equal(calls.length, 3)
  assert.equal(calls[0].url, itemUrl)
  assert.equal(calls[1].url, "https://news.ycombinator.com/comment")
  assert.equal(calls[1].options.method, "POST")
  assert.equal(calls[1].options.headers.Cookie, `user=${cookie}`)
  assert.equal(calls[1].options.redirect, "manual")
  const params = new URLSearchParams(calls[1].options.body)
  assert.equal(params.get("parent"), String(parentId))
  assert.equal(params.get("goto"), `item?id=${parentId}`)
  assert.equal(params.get("hmac"), hmac)
  assert.equal(params.get("text"), "Least privilege helps.\n\nSecond paragraph.")
})

test("still succeeds with formatted fallback when post-302 lookup fails", async () => {
  let count = 0
  mock.method(globalThis, "fetch", async () => {
    count++
    if (count === 1) return new Response(itemPage())
    if (count === 2) return new Response(null, { status: 302, headers: { Location: `item?id=${parentId}` } })
    throw new Error("timeout")
  })

  const comment = await postComment(parentId, "First line\nSecond line\n\n<tag>", cookie)
  assert.ok(comment.id < 0)
  assert.equal(comment.author, "ndom91")
  assert.equal(comment.isYou, true)
  assert.equal(comment.html, "<p>First line<br>Second line</p><p>&lt;tag&gt;</p>")
})

test("surfaces HN rate-limit / rejection messages cleanly", async () => {
  let count = 0
  mock.method(globalThis, "fetch", async () => {
    count++
    if (count === 1) return new Response(itemPage())
    return new Response("<html><body>You&#x27;re posting too fast. Try again in a minute.</body></html>", {
      status: 200,
    })
  })

  await assert.rejects(postComment(parentId, "Hello", cookie), {
    message: "Couldn't post: you're posting too fast. Try again in a minute.",
  })
})

test("detects expired session on initial fetch or login redirect", async () => {
  mock.method(globalThis, "fetch", async () => new Response('<a href="login">login</a>'))
  await assert.rejects(postComment(parentId, "Hello", cookie), /session expired/)
  mock.restoreAll()

  let count = 0
  mock.method(globalThis, "fetch", async () => {
    count++
    if (count === 1) return new Response(itemPage())
    return new Response(null, { status: 302, headers: { Location: "login?goto=comment" } })
  })
  await assert.rejects(postComment(parentId, "Hello", cookie), /session expired/)
})

test("rejects empty text, missing cookie, and malformed cookie without fetching", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => assert.fail("Unexpected fetch"))
  await assert.rejects(postComment(parentId, "   ", cookie), /Write a comment/)
  await assert.rejects(postComment(parentId, "Hello", ""), /Log in to HN/)
  await assert.rejects(postComment(parentId, "Hello", "a=1; b=2"), /invalid/)
  await assert.rejects(postComment(parentId, "Hello", "a\r\nX: 1"), /invalid/)
  assert.equal(fetch.mock.callCount(), 0)
})

test("rejects pages missing a matching comment form", async () => {
  mock.method(globalThis, "fetch", async () => new Response('<a href="logout?auth=1">logout</a><p>Closed</p>'))
  await assert.rejects(postComment(parentId, "Hello", cookie), /isn't allowing comments/)
})

test("network errors never expose cookie or hmac", async () => {
  let count = 0
  mock.method(globalThis, "fetch", async () => {
    if (++count === 1) return new Response(itemPage())
    throw new Error(`failed cookie=${cookie} hmac=${hmac}`)
  })
  await assert.rejects(postComment(parentId, "Hello", cookie), {
    message: "Couldn't reach Hacker News. Try again.",
  })
})

test("formatPlainComment escapes HTML and splits paragraphs", () => {
  assert.equal(
    formatPlainComment('Line 1 & "quoted"\nLine 2\n\nSecond <p>'),
    "<p>Line 1 &amp; &quot;quoted&quot;<br>Line 2</p><p>Second &lt;p&gt;</p>",
  )
})

test("insertComment appends top-level comments and prepends inline replies", () => {
  const existing = [
    {
      id: 1,
      author: "a",
      time: 1,
      html: "<p>a</p>",
      children: [{ id: 2, author: "b", time: 2, html: "<p>b</p>", children: [] }],
    },
  ]
  const reply = { id: 3, author: "me", time: 3, html: "<p>reply</p>", children: [], isYou: true }
  const withReply = insertComment(existing, 1, reply)
  assert.deepEqual(
    withReply[0].children.map((c) => c.id),
    [3, 2],
  )

  const top = { id: 4, author: "me", time: 4, html: "<p>top</p>", children: [], isYou: true }
  const withTop = insertComment(existing, null, top)
  assert.deepEqual(
    withTop.map((c) => c.id),
    [1, 4],
  )
})
