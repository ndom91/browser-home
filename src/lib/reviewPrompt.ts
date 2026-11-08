import { useSyncExternalStore } from "react"

export const DEFAULT_REVIEW_PROMPT =
  "Review this pull request. Read the full diff against its base branch. Report correctness bugs first, then risky changes, then smaller cleanups. Don't post anything to GitHub."

/** T3 Code refuses prompt links whose prompt is longer than this. */
export const REVIEW_PROMPT_MAX = 8000

// localStorage, not the settings cookie: only the browser needs it, so the server never should.
const KEY = "review-prompt"
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Keeps other tabs in step.
  const onStorage = (e: StorageEvent) => e.key === KEY && listener()
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

const read = () => localStorage.getItem(KEY) ?? ""

/** The custom review prompt, or "" when the default applies. */
export function useReviewPrompt() {
  const custom = useSyncExternalStore(subscribe, read, () => "")
  const setCustom = (value: string) => {
    if (value) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
    for (const l of listeners) l()
  }
  return { custom, prompt: custom.trim() || DEFAULT_REVIEW_PROMPT, setCustom }
}

/** Opens a new T3 Code thread on the PR. T3 adds the branch and review context itself and leaves the prompt as a draft. */
export function t3ReviewLink(prUrl: string, prompt: string) {
  return `t3code://new?${new URLSearchParams({ pr: prUrl, prompt })}`
}
