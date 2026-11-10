import type { LinearIssue, LinearIssues, StandupItem } from "../lib/types"
import { config } from "./config"

const API = "https://api.linear.app/graphql"
/** The page shows the Linear column only with both the key and the workspace slug. */
export const linearConfigured = () => Boolean(config().linear.api_key && config().linear.workspace)

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

async function linearQuery<T>(query: string): Promise<T> {
  const key = config().linear.api_key
  if (!key) throw new Error("linear.api_key is unset in config.yaml")
  const res = await fetch(API, {
    method: "POST",
    // Personal API keys go in as-is, without "Bearer".
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Linear ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (body.errors?.length || !body.data)
    throw new Error(body.errors?.map((e) => e.message).join("; ") ?? "Linear: no data")
  return body.data
}

type Assigned<N> = { viewer: { assignedIssues: { nodes: Array<N> } } }

export async function fetchLinear(): Promise<LinearIssues> {
  const data = await linearQuery<Assigned<RawIssue>>(QUERY)
  return {
    issues: data.viewer.assignedIssues.nodes.map((i) => ({
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

/** Your issues marked done since `since` (ISO time), for the standup card. */
export async function fetchCompletedIssues(since: string): Promise<Array<StandupItem>> {
  const data = await linearQuery<Assigned<{ identifier: string; title: string; url: string }>>(`query {
    viewer {
      assignedIssues(first: 20, orderBy: updatedAt, filter: { completedAt: { gte: ${JSON.stringify(since)} } }) {
        nodes { identifier title url }
      }
    }
  }`)
  return data.viewer.assignedIssues.nodes.map((i) => ({ kind: "issue", id: i.identifier, title: i.title, url: i.url }))
}
