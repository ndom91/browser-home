import assert from "node:assert/strict"
import { test } from "node:test"
import { cachedBy } from "../src/server/cache.ts"

test("keyed cache can wait for a stale refresh and shares it with other callers", async () => {
  let resolveRefresh
  let calls = 0
  const cache = cachedBy(async () => {
    calls++
    if (calls === 1) return "old"
    return new Promise((resolve) => {
      resolveRefresh = resolve
    })
  }, 0)

  assert.equal((await cache("pr")).data, "old")
  assert.equal((await cache("pr")).data, "old")
  let settled = false
  const waiting = cache("pr", { wait: true }).then((value) => {
    settled = true
    return value
  })
  await Promise.resolve()
  assert.equal(settled, false)
  assert.equal(calls, 2)
  resolveRefresh("new")
  assert.equal((await waiting).data, "new")
})
