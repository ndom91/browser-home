const HN = "https://news.ycombinator.com"

function voteLink(html: string, id: number, how: "up" | "un"): URL | null {
  for (const [tag] of html.matchAll(/<a\b[^>]*>/gi)) {
    const attr = (name: string) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1]
    if (attr("id") !== `${how}_${id}`) continue
    const url = URL.parse((attr("href") ?? "").replaceAll("&amp;", "&"), HN)
    if (
      url?.origin === HN &&
      url.pathname === "/vote" &&
      url.searchParams.get("id") === String(id) &&
      url.searchParams.get("how") === how &&
      url.searchParams.get("auth")
    )
      return url
  }
  return null
}

/** HN's write API is its website: fetch a fresh signed link, then verify the vote. */
export async function upvoteStory(id: number, sessionCookie: string): Promise<{ points: number }> {
  if (!sessionCookie) throw new Error("Connect your Hacker News session to vote from here.")
  if (/[;\r\n]/.test(sessionCookie)) throw new Error("The Hacker News session cookie is invalid.")

  const signal = AbortSignal.timeout(15_000)
  const request = async (url: string | URL) => {
    try {
      return await fetch(url, {
        headers: { Cookie: `user=${sessionCookie}` },
        redirect: "manual",
        signal,
      })
    } catch {
      // Fetch errors can include the signed URL; never send those to the client.
      throw new Error("Couldn't reach Hacker News. Try again.")
    }
  }
  const item = `${HN}/item?id=${id}`
  const page = async () => {
    const res = await request(item)
    if (!res.ok) throw new Error("Couldn't load the Hacker News voting page. Try again.")
    const html = await res.text()
    if (!/<a\b[^>]*href=["']logout\?/.test(html))
      throw new Error("Your Hacker News session expired. Update the session cookie to vote again.")
    return html
  }
  let html = await page()
  if (!voteLink(html, id, "un")) {
    const url = voteLink(html, id, "up")
    if (!url) throw new Error("Hacker News isn't allowing a vote on this story. Try voting on HN.")
    const res = await request(url)
    if (!res.ok && res.status !== 302 && res.status !== 303)
      throw new Error("Hacker News couldn't accept the vote. Try again.")
    html = await page()
    if (!voteLink(html, id, "un")) throw new Error("Hacker News didn't confirm the vote. Try voting on HN.")
  }
  const score = html.match(new RegExp(`id=["']score_${id}["'][^>]*>\\s*(\\d+)`))
  if (!score) throw new Error("Couldn't read the Hacker News score. Refresh the stories.")
  return { points: Number(score[1]) }
}
