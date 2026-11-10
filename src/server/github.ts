import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { PrNotification, PullRequest, PullRequests, StandupItem, Viewer } from "../lib/types"
import { config } from "./config"

const run = promisify(execFile)

// launchd starts us with a bare PATH, so default to the Homebrew location.
const GH_BIN = process.env.GH_BIN ?? "/opt/homebrew/bin/gh"

let token: string | null = null

async function getToken() {
  if (!token) {
    const { stdout } = await run(GH_BIN, ["auth", "token"])
    token = stdout.trim()
  }
  return token
}

/** A GitHub API call with the gh token. Retries once on 401, since gh may have rotated its token. */
async function rest(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const res = await fetch(`https://api.github.com/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "browser-home",
      ...init.headers,
    },
  })
  if (res.status === 401 && retry) {
    token = null
    return rest(path, init, false)
  }
  return res
}

async function graphql<T>(query: string, retry = true): Promise<T> {
  const res = await rest("graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  // Search with diff stats and CI rollups sometimes times out upstream.
  if ((res.status === 502 || res.status === 504) && retry) return graphql(query, false)
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as { data: T; errors?: Array<{ message: string }> }
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "))
  return body.data
}

const PR_FIELDS = `
  ... on PullRequest {
    number title body url isDraft reviewDecision updatedAt additions deletions
    author { login }
    repository { name nameWithOwner }
    viewerLatestReview { state }
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }`

const PAGE_SIZE = 20
// Extra search qualifiers, e.g. "org:my-company" to hide open-source noise.
const filter = () => config().github.search_filter

const ISSUE_ID = /\b[A-Z][A-Z0-9]+-\d+\b/
const LINEAR_URL = /linear\.app\/[\w-]+\/issue\/([A-Z][A-Z0-9]+-\d+)/i

// The title is the reliable source. The body is a fallback: a Linear URL first, then any
// bare ID, which can misfire on strings like "SHA-256".
function linearIssue(title: string, body: string): PullRequest["linear"] {
  // Linear issue links need the workspace slug, as in linear.app/<slug>/issue/CORE-123.
  const workspace = config().linear.workspace
  if (!workspace) return null
  const id = title.match(ISSUE_ID)?.[0] ?? body.match(LINEAR_URL)?.[1]?.toUpperCase() ?? body.match(ISSUE_ID)?.[0]
  return id ? { id, url: `https://linear.app/${workspace}/issue/${id}` } : null
}

const searchQuery = (q: string) => `
  query {
    search(query: "${q} ${filter()} archived:false sort:updated-desc", type: ISSUE, first: ${PAGE_SIZE}) {
      issueCount
      nodes { ${PR_FIELDS} }
    }
  }`

interface RawPR {
  number: number
  title: string
  body: string
  url: string
  isDraft: boolean
  reviewDecision: PullRequest["review"]
  updatedAt: string
  additions: number
  deletions: number
  author: { login: string } | null
  repository: { name: string; nameWithOwner: string }
  viewerLatestReview: { state: string } | null
  commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> }
}

interface RawSearch {
  issueCount: number
  nodes: Array<RawPR>
}

function shape(pr: RawPR): PullRequest {
  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    repo: pr.repository.name,
    repoFull: pr.repository.nameWithOwner,
    author: pr.author?.login ?? null,
    draft: pr.isDraft,
    review: pr.reviewDecision,
    checks: (pr.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null) as PullRequest["checks"],
    additions: pr.additions,
    deletions: pr.deletions,
    // A pending request on a PR you already reviewed means "look again".
    reviewedByMe: pr.viewerLatestReview != null,
    updatedAt: pr.updatedAt,
    linear: linearIssue(pr.title, pr.body),
  }
}

export async function fetchPRs(): Promise<PullRequests> {
  // Two small parallel searches are faster and fail less than one big query.
  const [mine, review] = await Promise.all([
    graphql<{ search: RawSearch }>(searchQuery("is:pr is:open author:@me")),
    graphql<{ search: RawSearch }>(searchQuery("is:pr is:open review-requested:@me")),
  ])
  return {
    mine: mine.search.nodes.map(shape),
    mineTotal: mine.search.issueCount,
    review: review.search.nodes.map(shape),
    reviewTotal: review.search.issueCount,
  }
}

export async function fetchViewer(): Promise<Viewer> {
  const data = await graphql<{ viewer: { login: string; name: string | null } }>(`query { viewer { login name } }`)
  return { login: data.viewer.login, name: data.viewer.name }
}

// Activity worth a row icon. "review_requested" is left out: the "Review requested"
// section already shows those, so the icon would only add noise.
const SIGNAL_REASONS = new Set(["comment", "mention", "team_mention", "author", "state_change"])

interface RawThread {
  id: string
  reason: string
  updated_at: string
  subject: { type: string; url: string | null }
}

// The last list, replayed on 304. GitHub doesn't count 304s against the rate limit.
let lastModified: string | null = null
let lastNotifications: Array<PrNotification> = []

/** Unread notifications on pull requests, keyed to the PR's web URL so rows can find them. */
export async function fetchNotifications(): Promise<Array<PrNotification>> {
  const res = await rest("notifications?per_page=50", {
    headers: lastModified ? { "If-Modified-Since": lastModified } : {},
  })
  if (res.status === 304) return lastNotifications
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`)
  const threads = (await res.json()) as Array<RawThread>
  lastModified = res.headers.get("Last-Modified")
  lastNotifications = threads.flatMap((t) => {
    // api.github.com/repos/o/r/pulls/12 -> github.com/o/r/pull/12, the URL PR rows carry.
    const path = t.subject.url?.match(/\/repos\/(.+)\/pulls\/(\d+)$/)
    if (t.subject.type !== "PullRequest" || !path || !SIGNAL_REASONS.has(t.reason)) return []
    return [
      {
        threadId: t.id,
        prUrl: `https://github.com/${path[1]}/pull/${path[2]}`,
        reason: t.reason,
        updatedAt: t.updated_at,
      },
    ]
  })
  return lastNotifications
}

/** Marks a notification read on GitHub, and drops it from the list a 304 would replay. */
export async function markNotificationRead(threadId: string) {
  const res = await rest(`notifications/threads/${encodeURIComponent(threadId)}`, { method: "PATCH" })
  if (!res.ok && res.status !== 304) throw new Error(`GitHub ${res.status}: ${await res.text()}`)
  lastNotifications = lastNotifications.filter((n) => n.threadId !== threadId)
}

interface RawShipped {
  number: number
  title: string
  body: string
  url: string
  repository: { name: string }
}

export interface ShippedPR extends StandupItem {
  linearId: string | null
}

/**
 * Your PRs merged, and opened, since `since` (ISO time), for the standup card. One query
 * with two small searches and no diff stats or CI rollups, so it stays fast.
 */
export async function fetchMyPRsSince(since: string) {
  const search = (qualifier: string) => `search(
    query: "is:pr author:@me ${qualifier}>=${since} ${filter()}", type: ISSUE, first: 20
  ) { nodes { ... on PullRequest { number title body url repository { name } } } }`
  const data = await graphql<{ merged: { nodes: Array<RawShipped> }; opened: { nodes: Array<RawShipped> } }>(
    `query { merged: ${search("is:merged merged:")} opened: ${search("created:")} }`,
  )
  const item = (pr: RawShipped): ShippedPR => ({
    kind: "pr",
    id: `${pr.repository.name}#${pr.number}`,
    title: pr.title,
    url: pr.url,
    linearId: linearIssue(pr.title, pr.body)?.id ?? null,
  })
  return { merged: data.merged.nodes.map(item), opened: data.opened.nodes.map(item) }
}
