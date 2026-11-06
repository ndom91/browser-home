import type { HNComment, HNThread, Story } from "../lib/types"
import { sanitizeHtml } from "./sanitize"

const API = "https://hacker-news.firebaseio.com/v0"
export const HN_COUNT = 24

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
      const discussion = `https://news.ycombinator.com/item?id=${item.id}`
      return {
        id: item.id,
        title: item.title,
        url: item.url ?? discussion,
        domain: item.url ? new URL(item.url).hostname.replace(/^www\./, "") : "news.ycombinator.com",
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

const countAll = (comments: Array<HNComment>): number => comments.reduce((n, c) => n + 1 + countAll(c.children), 0)

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
  const comments = toComments(tree.children).sort(
    (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  )
  const discussion = `https://news.ycombinator.com/item?id=${id}`
  return {
    id,
    title: tree.title ?? "",
    url: tree.url ?? discussion,
    domain: tree.url ? new URL(tree.url).hostname.replace(/^www\./, "") : "news.ycombinator.com",
    author: tree.author ?? "[deleted]",
    points: tree.points ?? 0,
    time: tree.created_at_i * 1000,
    html: tree.text ? sanitizeHtml(tree.text) : null,
    comments,
    total: countAll(comments),
  }
}
