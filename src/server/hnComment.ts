import type { HNComment } from "../lib/types"
import { sanitizeHtml } from "./sanitize"

const HN = "https://news.ycombinator.com"
export const MAX_HN_COMMENT = 16_000

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const decodeEntities = (value: string) =>
  value
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1]

/** Renders plain text into safe paragraph HTML matching HN's basic layout. */
export function formatPlainComment(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return ""
  return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, "<br>")}</p>`).join("")
}

function parseCommentForm(html: string, parentId: number) {
  const form = html.match(/<form\b[^>]*action=["']comment["'][^>]*>([\s\S]*?)<\/form>/i)?.[1]
  if (!form) return null
  const fields = new Map<string, string>()
  for (const [tag] of form.matchAll(/<input\b[^>]*>/gi)) {
    const name = attr(tag, "name")
    const value = attr(tag, "value")
    if (name && value !== undefined) fields.set(name, decodeEntities(value))
  }
  const hmac = fields.get("hmac")
  const parent = fields.get("parent")
  if (!hmac || parent !== String(parentId)) return null
  return { hmac, goto: fields.get("goto") || `item?id=${parentId}` }
}

function parseUsername(html: string, sessionCookie: string): string {
  const me = html.match(/<a\b[^>]*id=["']me["'][^>]*>([^<]+)<\/a>/i)?.[1]?.trim()
  if (me) return decodeEntities(me)
  const fromCookie = sessionCookie.split("&")[0]?.trim()
  return fromCookie || "you"
}

function commentIds(html: string): Set<number> {
  const ids = new Set<number>()
  for (const match of html.matchAll(/<tr\b[^>]*class=["'][^"']*\bcomtr\b[^"']*["'][^>]*\bid=["'](\d+)["']/gi)) {
    ids.add(Number(match[1]))
  }
  return ids
}

function findPostedComment(
  html: string,
  author: string,
  existingIds: Set<number>,
): { id: number; html: string } | null {
  const authorLower = author.toLowerCase()
  const chunks = html.split(/<tr\b[^>]*class=["'][^"']*\bcomtr\b[^"']*["'][^>]*\bid=["'](\d+)["'][^>]*>/i)
  let best: { id: number; html: string } | null = null
  for (let i = 1; i < chunks.length; i += 2) {
    const id = Number(chunks[i])
    const body = chunks[i + 1] ?? ""
    if (existingIds.has(id)) continue
    if (!/\bindent=["']0["']/i.test(body)) continue
    const rowAuthor = body.match(/<a\b[^>]*href=["']user\?id=([^"']+)["'][^>]*>/i)?.[1]
    if (!rowAuthor || decodeEntities(rowAuthor).toLowerCase() !== authorLower) continue
    const commtext = body.match(
      /<div\b[^>]*class=["'][^"']*\bcommtext\b[^"']*["'][^>]*>([\s\S]*?)(?:<div\b[^>]*class=["'][^"']*\breply\b|<\/div>\s*<\/div>)/i,
    )?.[1]
    if (!commtext) continue
    if (!best || id > best.id) best = { id, html: sanitizeHtml(commtext.trim()) }
  }
  return best
}

function extractPostError(html: string): string {
  if (/<form\b[^>]*action=["']login["']/i.test(html) || /you have to be logged in/i.test(html)) {
    return "Your Hacker News session expired. Update the session cookie to comment."
  }
  const stripped = decodeEntities(
    html
      .replace(/<(script|style|head|form)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
  if (stripped && stripped.length <= 220) {
    const reason = stripped.charAt(0).toLowerCase() + stripped.slice(1)
    return `Couldn't post: ${reason}`
  }
  return "Hacker News couldn't accept the comment. Try again."
}

/** HN's write API is its website: fetch a fresh signed form, then POST /comment. */
export async function postComment(parentId: number, text: string, sessionCookie: string): Promise<HNComment> {
  const body = text.trim()
  if (!body) throw new Error("Write a comment before posting.")
  if (body.length > MAX_HN_COMMENT) throw new Error(`Keep it under ${MAX_HN_COMMENT} characters.`)
  if (!sessionCookie) throw new Error("Log in to HN to comment.")
  if (/[;\r\n]/.test(sessionCookie)) throw new Error("The Hacker News session cookie is invalid.")

  const signal = AbortSignal.timeout(15_000)
  const request = async (url: string, init?: RequestInit) => {
    try {
      return await fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          Cookie: `user=${sessionCookie}`,
        },
        redirect: "manual",
        signal,
      })
    } catch {
      // Fetch errors can include request headers/URLs; never expose those to the client.
      throw new Error("Couldn't reach Hacker News. Try again.")
    }
  }

  const itemUrl = `${HN}/item?id=${parentId}`
  const itemRes = await request(itemUrl)
  if (!itemRes.ok) throw new Error("Couldn't load the Hacker News page. Try again.")
  const itemHtml = await itemRes.text()
  if (!/<a\b[^>]*href=["']logout\?/.test(itemHtml)) {
    throw new Error("Your Hacker News session expired. Update the session cookie to comment.")
  }

  const form = parseCommentForm(itemHtml, parentId)
  if (!form) throw new Error("Hacker News isn't allowing comments on this item.")

  const author = parseUsername(itemHtml, sessionCookie)
  const existingIds = commentIds(itemHtml)

  const postRes = await request(`${HN}/comment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: HN,
      Referer: itemUrl,
    },
    body: new URLSearchParams({
      parent: String(parentId),
      goto: form.goto,
      hmac: form.hmac,
      text: body,
    }).toString(),
  })

  if (postRes.status === 302 || postRes.status === 303) {
    const location = postRes.headers.get("location") ?? ""
    if (/(?:^|\/)(?:news)?login\b/i.test(location)) {
      throw new Error("Your Hacker News session expired. Update the session cookie to comment.")
    }

    // Best-effort lookup for the newly created comment's real HN id and rendered HTML.
    // Never fail after HN already accepted the 302, or retrying would double-post.
    let created: { id: number; html: string } | null = null
    try {
      const checkRes = await request(itemUrl)
      if (checkRes.ok) created = findPostedComment(await checkRes.text(), author, existingIds)
    } catch {
      // Fall back to locally formatted HTML below.
    }

    return {
      id: created?.id ?? -Date.now(),
      author,
      time: Date.now(),
      html: created?.html || formatPlainComment(body),
      children: [],
      points: 1,
      isYou: true,
    }
  }

  const responseText = await postRes.text().catch(() => "")
  throw new Error(extractPostError(responseText))
}
