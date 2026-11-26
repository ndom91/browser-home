const HN = "https://news.ycombinator.com"

function voteControl(html: string, id: number, how: "up" | "un") {
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
      return { url, hidden: (attr("class") ?? "").split(/\s+/).includes("nosee") }
  }
  return null
}

function hasUpvote(html: string, id: number): boolean {
  // After HN's undo window closes, only the hidden upvote arrow remains.
  return Boolean(voteControl(html, id, "un") || voteControl(html, id, "up")?.hidden)
}

async function submitUpvote(id: number, sessionCookie: string, kind: "story" | "comment"): Promise<string> {
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
  if (!hasUpvote(html, id)) {
    const control = voteControl(html, id, "up")
    if (!control) throw new Error(`Hacker News isn't allowing a vote on this ${kind}. Try voting on HN.`)
    const res = await request(control.url)
    if (!res.ok && res.status !== 302 && res.status !== 303)
      throw new Error("Hacker News couldn't accept the vote. Try again.")
    html = await page()
    if (!hasUpvote(html, id)) throw new Error("Hacker News didn't confirm the vote. Try voting on HN.")
  }
  return html
}

/** HN's write API is its website: fetch a fresh signed link, then verify the vote. */
export async function upvoteStory(id: number, sessionCookie: string): Promise<{ points: number }> {
  const html = await submitUpvote(id, sessionCookie, "story")
  const score = html.match(new RegExp(`id=["']score_${id}["'][^>]*>\\s*(\\d+)`))
  if (!score) throw new Error("Couldn't read the Hacker News score. Refresh the stories.")
  return { points: Number(score[1]) }
}

/** Upvotes a comment on HN. Comments don't expose a public score, so only confirmation is checked. */
export async function upvoteComment(id: number, sessionCookie: string): Promise<{ upvoted: true }> {
  await submitUpvote(id, sessionCookie, "comment")
  return { upvoted: true }
}
