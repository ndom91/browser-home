import { previousWorkday } from "../lib/standup"
import type { LinearIssue, Standup, StandupItem } from "../lib/types"
import { fetchMyPRsSince } from "./github"
import { fetchCompletedIssues, linearConfigured } from "./linear"

/**
 * The standup card for a standup starting at `start`: what you finished and opened since
 * the previous workday's standup, and what's in progress now.
 */
export async function fetchStandup(start: string, assigned: Array<LinearIssue>): Promise<Standup> {
  // GitHub search takes ISO times, but not with milliseconds.
  const since = new Date(previousWorkday(Date.parse(start))).toISOString().replace(/\.\d{3}Z$/, "Z")
  const [prs, issues] = await Promise.all([
    fetchMyPRsSince(since),
    linearConfigured() ? fetchCompletedIssues(since) : Promise.resolve([]),
  ])

  // A merged PR for an issue that's already listed as done becomes that issue's PR link.
  const doneIds = new Set(issues.map((i) => i.id))
  const done: Array<StandupItem> = [
    ...issues.map((i) => ({ ...i, pr: prs.merged.find((p) => p.linearId === i.id)?.url })),
    ...prs.merged.filter((p) => !p.linearId || !doneIds.has(p.linearId)).map(withoutLinearId),
  ]
  const merged = new Set(prs.merged.map((p) => p.url))
  return {
    since,
    done,
    opened: prs.opened.filter((p) => !merged.has(p.url)).map(withoutLinearId),
    inProgress: assigned
      .filter((i) => i.state.type === "started")
      .map((i) => ({ kind: "issue", id: i.id, title: i.title, url: i.url })),
  }
}

function withoutLinearId({ linearId: _, ...item }: StandupItem & { linearId: string | null }): StandupItem {
  return item
}
