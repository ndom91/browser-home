import type { Story } from "../lib/types"

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
