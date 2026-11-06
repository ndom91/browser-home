import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { PullRequest, PullRequests, Viewer } from "../lib/types"

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

async function graphql<T>(query: string, retry = true): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "application/json",
      "User-Agent": "browser-home",
    },
    body: JSON.stringify({ query }),
  })
  // gh may have refreshed or rotated its token since we cached it.
  if (res.status === 401 && retry) {
    token = null
    return graphql(query, false)
  }
  // Search with diff stats and CI rollups sometimes times out upstream.
  if ((res.status === 502 || res.status === 504) && retry) return graphql(query, false)
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as { data: T; errors?: Array<{ message: string }> }
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "))
  return body.data
}

const PR_FIELDS = `
  ... on PullRequest {
    number title url isDraft reviewDecision updatedAt additions deletions
    author { login }
    repository { name nameWithOwner }
    viewerLatestReview { state }
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }`

const PAGE_SIZE = 20
// Extra search qualifiers. Scoped to the work org by default to hide open-source noise.
// `||`, not `??`: the launchd plist sets the variable to an empty string.
const FILTER = process.env.GH_SEARCH_FILTER?.trim() || "org:team-plain"

const searchQuery = (q: string) => `
  query {
    search(query: "${q} ${FILTER} archived:false sort:updated-desc", type: ISSUE, first: ${PAGE_SIZE}) {
      issueCount
      nodes { ${PR_FIELDS} }
    }
  }`

interface RawPR {
  number: number
  title: string
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
