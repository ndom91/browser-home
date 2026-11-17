import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"
import { upvoteStory } from "../src/server/hnVote.ts"

const id = 50532086
const item = `https://news.ycombinator.com/item?id=${id}`
const cookie = "test-user-session"
const auth = "test-vote-token"
const page = (how = "up", href = `vote?id=${id}&amp;how=${how}&amp;auth=${auth}`) =>
  `<a href="logout?auth=test">logout</a><a id='${how}_${id}' href='${href}'>vote</a>` +
  `<span class="score" id="score_${id}">65 points</span>`

afterEach(() => mock.restoreAll())

test("uses HN's signed link with the session cookie and confirms the vote", async () => {
  const calls = []
  mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url: String(url), options })
    if (calls.length === 1) return new Response(page())
    if (calls.length === 2) return new Response(null, { status: 302, headers: { Location: item } })
    return new Response(page("un"))
  })
  assert.deepEqual(await upvoteStory(id, cookie), { points: 65 })
  assert.deepEqual(
    calls.map((call) => call.url),
    [item, `https://news.ycombinator.com/vote?id=${id}&how=up&auth=${auth}`, item],
  )
  for (const call of calls) {
    assert.equal(call.options.headers.Cookie, `user=${cookie}`)
    assert.equal(call.options.redirect, "manual")
  }
})

test("an existing upvote succeeds without sending another vote", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => new Response(page("un")))
  assert.deepEqual(await upvoteStory(id, cookie), { points: 65 })
  assert.equal(fetch.mock.callCount(), 1)
})

test("an HTTP 200 without a confirmed upvote is a failure", async () => {
  mock.method(globalThis, "fetch", async () => new Response(page()))
  await assert.rejects(upvoteStory(id, cookie), /didn't confirm/)
})

test("a logged-out page means the session expired", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => new Response('<a href="login">login</a>'))
  await assert.rejects(upvoteStory(id, cookie), /session expired/)
  assert.equal(fetch.mock.callCount(), 1)
})

test("missing or malformed session cookies never reach HN", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => assert.fail("Unexpected fetch"))
  await assert.rejects(upvoteStory(id, ""), /Connect your/)
  await assert.rejects(upvoteStory(id, "user=value; other=value"), /invalid/)
  await assert.rejects(upvoteStory(id, "value\r\nInjected: header"), /invalid/)
  assert.equal(fetch.mock.callCount(), 0)
})

test("rejects vote links with another origin, action, item, or no auth", async () => {
  for (const href of [
    `https://example.com/vote?id=${id}&how=up&auth=${auth}`,
    `vote?id=${id}&how=down&auth=${auth}`,
    `vote?id=1&how=up&auth=${auth}`,
    `vote?id=${id}&how=up`,
  ]) {
    const fetch = mock.method(globalThis, "fetch", async () => new Response(page("up", href)))
    await assert.rejects(upvoteStory(id, cookie), /isn't allowing/)
    assert.equal(fetch.mock.callCount(), 1)
    mock.restoreAll()
  }
})

test("doesn't follow redirects from the authenticated item page", async () => {
  const fetch = mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 302, headers: { Location: "https://example.com" } }),
  )
  await assert.rejects(upvoteStory(id, cookie), /Couldn't load/)
  assert.equal(fetch.mock.callCount(), 1)
})

test("network errors never expose the signed URL", async () => {
  let count = 0
  mock.method(globalThis, "fetch", async (url) => {
    if (++count === 1) return new Response(page())
    throw new Error(`Fetch failed: ${url} cookie=${cookie}`)
  })
  await assert.rejects(upvoteStory(id, cookie), { message: "Couldn't reach Hacker News. Try again." })
})
