import assert from "node:assert/strict"
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createServer } from "vite"

test("keeps available PR activity when a GitHub activity request fails", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pr-detail-test-"))
  const gh = join(dir, "gh")
  await writeFile(gh, "#!/bin/sh\nprintf test-token\n")
  await chmod(gh, 0o755)
  const previousGh = process.env.GH_BIN
  const previousFetch = globalThis.fetch
  process.env.GH_BIN = gh
  globalThis.fetch = async (input) => {
    const url = String(input)
    const json = (value) => Response.json(value)
    if (url.endsWith("/graphql")) {
      return json({
        data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasPreviousPage: false }, nodes: [] } } } },
      })
    }
    if (url.endsWith("/pulls/42")) {
      return json({
        body_html: "<p>Description</p>",
        head: { sha: "abc" },
        requested_reviewers: [],
        requested_teams: [],
        changed_files: 0,
      })
    }
    if (url.includes("/issues/42/comments?")) {
      return json([
        {
          id: 1,
          user: { login: "author", type: "User" },
          body_html: "<p>Still visible</p>",
          body_text: "Still visible",
          created_at: "2026-01-01T00:00:00Z",
          html_url: "https://github.com/example",
        },
      ])
    }
    if (url.includes("/pulls/42/reviews?")) return new Response("Unavailable", { status: 500 })
    if (url.includes("/check-runs?")) return json({ total_count: 0, check_runs: [] })
    if (url.includes("/pulls/42/files?")) return json([])
    throw new Error(`Unexpected request: ${url}`)
  }
  const server = await createServer({
    configFile: false,
    cacheDir: join(dir, "vite-cache"),
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  })
  try {
    const { fetchPRDetail } = await server.ssrLoadModule("/src/server/github.ts")
    const detail = await fetchPRDetail("owner/repo/42")
    assert.equal(detail.activityError, true)
    assert.equal(detail.activity.length, 1)
    assert.match(detail.activity[0].body, /Still visible/)
    assert.equal(detail.checksError, false)
    assert.equal(detail.filesError, false)
  } finally {
    await server.close()
    globalThis.fetch = previousFetch
    if (previousGh === undefined) delete process.env.GH_BIN
    else process.env.GH_BIN = previousGh
    await rm(dir, { recursive: true, force: true })
  }
})
