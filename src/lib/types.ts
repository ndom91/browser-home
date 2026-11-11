export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  calendar: string
  color: string | null
  location: string | null
  status: "accepted" | "declined" | "tentative" | "pending" | null
  attendees: Array<string>
  meeting: string | null
  provider: string | null
}

export interface PullRequest {
  number: number
  title: string
  url: string
  repo: string
  repoFull: string
  author: string | null
  draft: boolean
  review: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null
  checks: "SUCCESS" | "FAILURE" | "ERROR" | "PENDING" | "EXPECTED" | null
  additions: number
  deletions: number
  reviewedByMe: boolean
  updatedAt: string
  linear: { id: string; url: string } | null
}

export interface PRActivityComment {
  id: string
  author: string
  isBot: boolean
  body: string
  preview: string
  at: string
  url: string
}

export interface PRActivity extends PRActivityComment {
  kind: string
  thread?: { path: string; resolved: boolean; replies: Array<PRActivityComment> }
}

export interface PRDetail {
  description: string
  files: Array<{ path: string; status: string; additions: number; deletions: number; url: string }>
  filesMore: boolean
  filesError: boolean
  reviewers: Array<string>
  activity: Array<PRActivity>
  activityMore: boolean
  activityError: boolean
  checks: Array<{ id: number; name: string; status: string; url: string | null; durationMs: number | null }>
  checksTotal: number
  checksError: boolean
}

/** An unread GitHub notification on one of the listed PRs. */
export interface PrNotification {
  threadId: string
  prUrl: string
  reason: string
  updatedAt: string
}

export interface PullRequests {
  mine: Array<PullRequest>
  mineTotal: number
  review: Array<PullRequest>
  reviewTotal: number
}

export interface Story {
  id: number
  title: string
  url: string
  domain: string
  points: number
  comments: number
  time: number
  discussion: string
}

export interface Viewer {
  login: string
  name: string | null
}

export interface Weather {
  /** WMO weather interpretation code for the day. */
  code: number
  max: number
  min: number
}

export interface HNComment {
  id: number
  author: string
  time: number
  /** Sanitized HTML: only p, a, i, b, em, strong, pre, code, br. */
  html: string
  children: Array<HNComment>
}

export interface HNThread {
  id: number
  title: string
  url: string
  domain: string
  author: string
  points: number
  time: number
  /** Body of Ask/Show HN posts, sanitized like comments. */
  html: string | null
  comments: Array<HNComment>
  /** All comments, including nested ones. */
  total: number
}

export interface LinearIssue {
  id: string
  title: string
  url: string
  /** 0 none, 1 urgent, 2 high, 3 medium, 4 low (Linear's scale). */
  priority: number
  priorityLabel: string
  updatedAt: string
  state: { name: string; type: "started" | "unstarted" | "backlog"; color: string }
  project: { name: string; color: string } | null
  team: string
  cycle: number | null
}

/** A line on the standup card. `id` is "CORE-123" for an issue, "repo#12" for a PR. */
export interface StandupItem {
  kind: "issue" | "pr"
  id: string
  title: string
  url: string
  /** A done issue's merged PR, shown as a link instead of its own row. */
  pr?: string
}

/** What you did since the previous workday's standup, for today's. */
export interface Standup {
  since: string
  done: Array<StandupItem>
  opened: Array<StandupItem>
  inProgress: Array<StandupItem>
}

export interface LinearIssues {
  issues: Array<LinearIssue>
}

/** Optional parts of the page. Each is on only when its config.yaml settings are there. */
export interface Features {
  chat: boolean
  linear: boolean
  capture: boolean
}
