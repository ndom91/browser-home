import { useEffect } from "react"
import type { PrNotification, PullRequests } from "./types"

const BASE_TITLE = "Home"

/**
 * Things that need you: review requests, your own PRs with failing checks, and unread
 * activity on any listed PR.
 */
function attentionCount(prs: PullRequests | undefined, notifications: Array<PrNotification> = []) {
  if (!prs) return 0
  const failing = prs.mine.filter((pr) => pr.checks === "FAILURE" || pr.checks === "ERROR").length
  const listed = new Set([...prs.mine, ...prs.review].map((pr) => pr.url))
  const unread = notifications.filter((n) => listed.has(n.prUrl)).length
  return prs.reviewTotal + failing + unread
}

/** "(3) Home" in the tab, so you see it from any other tab. Unfiltered, so PR filters never hide anything. */
export function useTitleCount(prs: PullRequests | undefined, notifications?: Array<PrNotification>) {
  const count = attentionCount(prs, notifications)
  useEffect(() => {
    document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE
  }, [count])
}
