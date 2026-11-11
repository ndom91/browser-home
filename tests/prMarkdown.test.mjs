import assert from "node:assert/strict"
import { test } from "node:test"
import { sanitizePRHtml } from "../src/server/prMarkdown.ts"

test("preserves GitHub's rendered comment markup and removes comments", () => {
  const html = sanitizePRHtml(
    '<!-- bot --><h2><a href="https://example.com"><picture><source media="(prefers-color-scheme: dark)" srcset="https://example.com/dark.svg"><img src="https://example.com/light.svg" alt="Badge"></picture></a>Summary</h2><details><summary>Notes</summary><p>Done</p></details>',
  )
  assert.match(html, /<h2>/)
  assert.match(html, /<picture>/)
  assert.match(html, /srcset="https:\/\/example.com\/dark.svg"/)
  assert.match(html, /<details>/)
  assert.doesNotMatch(html, /<!--/)
})

test("removes executable markup, unsafe URLs and active form controls", () => {
  const html = sanitizePRHtml(
    '<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(2)"><a href="javascript:alert(3)">link</a><svg onload="alert(4)"></svg><input type="text" autofocus><input type="checkbox" checked>',
  )
  assert.doesNotMatch(html, /script|onerror|onload|javascript:|autofocus|type="text"/i)
  assert.match(html, /type="checkbox"[^>]*disabled/)
})
