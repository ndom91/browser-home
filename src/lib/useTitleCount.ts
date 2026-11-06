import { useEffect } from "react"
import type { PullRequests } from "./types"

const BASE_TITLE = "Home"

/** Things that need you: review requests, plus your own PRs with failing checks. */
export function attentionCount(prs: PullRequests | undefined) {
  if (!prs) return 0
  const failing = prs.mine.filter((pr) => pr.checks === "FAILURE" || pr.checks === "ERROR").length
  return prs.reviewTotal + failing
}

/** "(3) Home" in the tab, so you see it from any other tab. Unfiltered, so PR filters never hide anything. */
export function useTitleCount(prs: PullRequests | undefined) {
  const count = attentionCount(prs)
  useEffect(() => {
    document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE
  }, [count])
}
