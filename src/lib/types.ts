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
