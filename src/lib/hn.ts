import type { HNComment } from "./types"

export const itemUrl = (id: number) => `https://news.ycombinator.com/item?id=${id}`

/** "github.com" for a story link. A malformed URL gets no domain instead of throwing. */
export const hostOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./, "") ?? ""

/** Comments in a tree, nested replies included. */
export const countComments = (comments: Array<HNComment>): number =>
  comments.reduce((n, c) => n + 1 + countComments(c.children), 0)
