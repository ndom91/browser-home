import type { LinearIssue, LinearIssues } from "../lib/types"

const API = "https://api.linear.app/graphql"
const KEY = process.env.LINEAR_API_KEY?.trim()

/** The page shows the Linear column only with both the key and the workspace slug. */
export const linearConfigured = Boolean(KEY && process.env.LINEAR_WORKSPACE?.trim())

// In progress, Todo and Backlog. Done and canceled stay out.
const QUERY = `query {
  viewer {
    assignedIssues(first: 50, orderBy: updatedAt, filter: { state: { type: { in: ["started", "unstarted", "backlog"] } } }) {
      nodes {
        identifier title url priority priorityLabel updatedAt
        state { name type color }
        project { name color }
        team { key }
        cycle { number }
      }
    }
  }
}`

interface RawIssue {
  identifier: string
  title: string
  url: string
  priority: number
  priorityLabel: string
  updatedAt: string
  state: LinearIssue["state"]
  project: LinearIssue["project"]
  team: { key: string }
  cycle: { number: number } | null
}

export async function fetchLinear(): Promise<LinearIssues> {
  if (!KEY) throw new Error("LINEAR_API_KEY is unset")
  const res = await fetch(API, {
    method: "POST",
    // Personal API keys go in as-is, without "Bearer".
    headers: { Authorization: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Linear ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as {
    data?: { viewer: { assignedIssues: { nodes: Array<RawIssue> } } }
    errors?: Array<{ message: string }>
  }
  if (body.errors?.length || !body.data)
    throw new Error(body.errors?.map((e) => e.message).join("; ") ?? "Linear: no data")
  return {
    issues: body.data.viewer.assignedIssues.nodes.map((i) => ({
      id: i.identifier,
      title: i.title,
      url: i.url,
      priority: i.priority,
      priorityLabel: i.priorityLabel,
      updatedAt: i.updatedAt,
      state: i.state,
      project: i.project,
      team: i.team.key,
      cycle: i.cycle?.number ?? null,
    })),
  }
}
