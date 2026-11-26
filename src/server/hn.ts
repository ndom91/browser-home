import { countComments, hostOf, itemUrl } from "../lib/hn"
import type { HNComment, HNThread, Story } from "../lib/types"
import { config } from "./config"
import { sanitizeHtml } from "./sanitize"

const API = "https://hacker-news.firebaseio.com/v0"
const HN = "https://news.ycombinator.com"
const HN_COUNT = 24

export function hnUsername(sessionCookie = config().hacker_news.session_cookie): string | null {
  if (!sessionCookie || /[;\r\n]/.test(sessionCookie)) return null
  return sessionCookie.split("&")[0]?.trim() || null
}

interface RawItem {
  id: number
  title: string
  url?: string
  score?: number
  descendants?: number
  time: number
  deleted?: boolean
  dead?: boolean
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/${path}.json`)
  if (!res.ok) throw new Error(`HN ${res.status} for ${path}`)
  return res.json() as Promise<T>
}

export async function fetchHN(): Promise<Array<Story>> {
  const ids = (await get<Array<number>>("topstories")).slice(0, HN_COUNT)
  const items = await Promise.all(ids.map((id) => get<RawItem | null>(`item/${id}`).catch(() => null)))
  return items
    .filter((item): item is RawItem => !!item && !item.deleted && !item.dead)
    .map((item) => {
      const discussion = itemUrl(item.id)
      return {
        id: item.id,
        title: item.title,
        url: item.url ?? discussion,
        domain: hostOf(item.url ?? discussion),
        points: item.score ?? 0,
        comments: item.descendants ?? 0,
        time: item.time * 1000,
        discussion,
      }
    })
}

interface AlgoliaItem {
  id: number
  type: string
  author: string | null
  title: string | null
  url: string | null
  text: string | null
  points: number | null
  created_at_i: number
  children: Array<AlgoliaItem>
}

function toComments(items: Array<AlgoliaItem>): Array<HNComment> {
  return (
    items
      // Deleted comments come back with no author and no text. HN hides them unless
      // they have replies, so keep those as placeholders.
      .filter((c) => c.type === "comment" && (c.author || c.children.length))
      .map((c) => ({
        id: c.id,
        author: c.author ?? "[deleted]",
        time: c.created_at_i * 1000,
        html: c.text ? sanitizeHtml(c.text) : "<p>[deleted]</p>",
        children: toComments(c.children),
      }))
  )
}

function collectOwnIds(comments: Array<HNComment>, userLower: string, out: Array<number>) {
  for (const c of comments) {
    if (c.author.toLowerCase() === userLower) out.push(c.id)
    if (c.children.length > 0) collectOwnIds(c.children, userLower, out)
  }
}

function attachPoints(comments: Array<HNComment>, scores: Map<number, number>): Array<HNComment> {
  return comments.map((c) => {
    const points = scores.get(c.id)
    const children = c.children.length > 0 ? attachPoints(c.children, scores) : c.children
    if (points === undefined && children === c.children) return c
    return { ...c, ...(points !== undefined ? { points } : {}), children }
  })
}

async function fetchOwnCommentPoints(
  storyId: number,
  ownIds: Array<number>,
  sessionCookie: string,
): Promise<Map<number, number>> {
  const scores = new Map<number, number>()
  try {
    const res = await fetch(`${HN}/item?id=${storyId}`, {
      headers: { Cookie: `user=${sessionCookie}` },
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return scores
    const html = await res.text()
    for (const id of ownIds) {
      const m = html.match(new RegExp(`id=["']score_${id}["'][^>]*>\\s*(\\d+)`))
      if (m) scores.set(id, Number(m[1]))
    }
  } catch {
    // Best-effort: comment scores are optional and never block loading the thread.
  }
  return scores
}

export async function fetchThread(id: number): Promise<HNThread> {
  // Algolia returns the whole tree in one call, but oldest first. HN's own API
  // gives the ranked order of top-level comments, so sort by that.
  const [tree, ranked] = await Promise.all([
    fetch(`https://hn.algolia.com/api/v1/items/${id}`, { signal: AbortSignal.timeout(15_000) }).then((res) => {
      if (!res.ok) throw new Error(`HN comments ${res.status} for ${id}`)
      return res.json() as Promise<AlgoliaItem>
    }),
    get<{ kids?: Array<number> } | null>(`item/${id}`).catch(() => null),
  ])

  const rank = new Map((ranked?.kids ?? []).map((kid, i) => [kid, i]))
  let comments = toComments(tree.children).sort(
    (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  )

  // HN only exposes comment scores on your own comments (and only when authenticated).
  // Skip the extra fetch unless this thread actually has a comment by you.
  const sessionCookie = config().hacker_news.session_cookie
  const user = hnUsername(sessionCookie)
  if (user) {
    const ownIds: Array<number> = []
    collectOwnIds(comments, user.toLowerCase(), ownIds)
    if (ownIds.length > 0) {
      const scores = await fetchOwnCommentPoints(id, ownIds, sessionCookie)
      if (scores.size > 0) comments = attachPoints(comments, scores)
    }
  }

  const url = tree.url ?? itemUrl(id)
  return {
    id,
    title: tree.title ?? "",
    url,
    domain: hostOf(url),
    author: tree.author ?? "[deleted]",
    points: tree.points ?? 0,
    time: tree.created_at_i * 1000,
    html: tree.text ? sanitizeHtml(tree.text) : null,
    comments,
    total: countComments(comments),
  }
}
