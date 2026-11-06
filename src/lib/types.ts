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
