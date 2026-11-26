import type { HNComment } from "./types"

export const itemUrl = (id: number) => `https://news.ycombinator.com/item?id=${id}`

/** "github.com" for a story link. A malformed URL gets no domain instead of throwing. */
export const hostOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./, "") ?? ""

// Paywalled news sites. Their story links open through archive.is instead.
const PAYWALLED = [
  "barrons.com",
  "bloomberg.com",
  "bostonglobe.com",
  "businessinsider.com",
  "economist.com",
  "foreignpolicy.com",
  "ft.com",
  "hbr.org",
  "latimes.com",
  "newyorker.com",
  "nikkei.com",
  "nytimes.com",
  "technologyreview.com",
  "telegraph.co.uk",
  "theatlantic.com",
  "theinformation.com",
  "thetimes.co.uk",
  "washingtonpost.com",
  "wired.com",
  "wsj.com",
]

/**
 * The link a story should open. Paywalled news goes through archive.is, with the query
 * string and hash dropped: those carry tracking and gift tokens, and archive.is keys its
 * snapshots by the exact URL, so a clean one finds an existing snapshot more often.
 */
export function readableUrl(url: string) {
  const u = URL.parse(url)
  if (!u) return url
  const host = u.hostname.replace(/^www\./, "")
  if (!PAYWALLED.some((d) => host === d || host.endsWith(`.${d}`))) return url
  return `https://archive.is/${u.origin}${u.pathname}`
}

/** Comments in a tree, nested replies included. */
export const countComments = (comments: Array<HNComment>): number =>
  comments.reduce((n, c) => n + 1 + countComments(c.children), 0)

/**
 * Inserts a newly posted comment where its composer was: at the top of a parent
 * comment's replies, or at the end of the thread for a top-level comment.
 */
export function insertComment(
  comments: Array<HNComment>,
  parentId: number | null,
  comment: HNComment,
): Array<HNComment> {
  if (parentId === null) return [...comments, comment]
  let inserted = false
  const walk = (list: Array<HNComment>): Array<HNComment> =>
    list.map((c) => {
      if (c.id === parentId) {
        inserted = true
        return { ...c, children: [comment, ...c.children] }
      }
      if (c.children.length === 0) return c
      const children = walk(c.children)
      return children === c.children ? c : { ...c, children }
    })
  const next = walk(comments)
  return inserted ? next : comments
}
