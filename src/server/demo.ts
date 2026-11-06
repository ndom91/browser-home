// Fixture data matching the design mockups. Enable with BROWSER_HOME_DEMO=1.
import type { CalendarEvent, PullRequest, PullRequests, Story, Viewer } from "../lib/types"

export const DEMO = process.env.BROWSER_HOME_DEMO === "1"

const MIN = 60_000
const HOUR = 60 * MIN

export function demoCalendar(): Array<CalendarEvent> {
  // Anchor the mockup's 10:30 "Design review" on the current half hour,
  // so "now" always lands inside it.
  const anchor = Math.floor(Date.now() / (30 * MIN)) * 30 * MIN
  const at = (offsetMin: number, durMin: number) => ({
    start: new Date(anchor + offsetMin * MIN).toISOString(),
    end: new Date(anchor + (offsetMin + durMin) * MIN).toISOString(),
  })
  const zoom = "https://acme.zoom.us/j/123456789"
  const base = { allDay: false, calendar: "Work", color: null, location: null, status: "accepted" as const }

  return [
    {
      ...base,
      id: "standup",
      title: "Platform standup",
      ...at(-90, 15),
      attendees: ["Dana", "Lee"],
      meeting: zoom,
      provider: "Zoom",
    },
    {
      ...base,
      id: "design",
      title: "Design review: queue filters",
      ...at(0, 30),
      attendees: ["Priya Patel", "Sam Ortiz", "Mara Lind"],
      meeting: zoom,
      provider: "Zoom",
    },
    {
      ...base,
      id: "priya",
      title: "1:1 with Priya",
      ...at(45, 25),
      attendees: ["Priya Patel"],
      meeting: zoom,
      provider: "Zoom",
    },
    // Declined and overlapping the 1:1, to cover both timeline paths.
    {
      ...base,
      id: "allhands",
      title: "Sales all-hands",
      ...at(45, 30),
      status: "declined",
      attendees: ["Sales"],
      meeting: "https://meet.google.com/abc-defg-hij",
      provider: "Meet",
    },
    { ...base, id: "lunch", title: "Lunch", ...at(90, 60), attendees: [], meeting: null, provider: null },
    {
      ...base,
      id: "acme",
      title: "Customer call: Acme onboarding",
      ...at(210, 30),
      attendees: ["Jo", "Kim"],
      meeting: zoom,
      provider: "Zoom",
    },
    {
      ...base,
      id: "sprint",
      title: "Sprint planning",
      ...at(300, 25),
      attendees: ["Team"],
      meeting: zoom,
      provider: "Zoom",
    },
    {
      ...base,
      id: "focus",
      title: "Focus: write queue RFC",
      ...at(390, 60),
      attendees: [],
      meeting: null,
      provider: null,
    },
  ]
}

function pr(
  p: Partial<PullRequest> & Pick<PullRequest, "number" | "title" | "repo" | "additions" | "deletions">,
  hoursAgo: number,
): PullRequest {
  return {
    url: `https://github.com/acme/${p.repo}/pull/${p.number}`,
    repoFull: `acme/${p.repo}`,
    author: null,
    draft: false,
    review: "REVIEW_REQUIRED",
    checks: "SUCCESS",
    reviewedByMe: false,
    updatedAt: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
    ...p,
  }
}

export function demoPRs(): PullRequests {
  const review = [
    pr(
      {
        number: 4830,
        title: "Fix SLA timer drift on snoozed threads",
        repo: "support-app",
        author: "mara",
        additions: 86,
        deletions: 12,
      },
      3,
    ),
    pr(
      {
        number: 4815,
        title: "Sidekick: stream partial drafts into composer",
        repo: "support-app",
        author: "sam",
        checks: "PENDING",
        reviewedByMe: true,
        additions: 1204,
        deletions: 310,
      },
      48,
    ),
    pr(
      {
        number: 412,
        title: "Bump Node to 22 in CI images",
        repo: "infra",
        author: "devon",
        additions: 9,
        deletions: 9,
      },
      24,
    ),
  ]
  const mine = [
    pr(
      {
        number: 4821,
        title: "Add keyboard shortcuts to thread composer",
        repo: "support-app",
        review: "APPROVED",
        additions: 312,
        deletions: 48,
      },
      5,
    ),
    pr(
      {
        number: 4797,
        title: "Migrate queue row to /ui Button",
        repo: "support-app",
        review: "CHANGES_REQUESTED",
        checks: "FAILURE",
        additions: 140,
        deletions: 221,
      },
      72,
    ),
    pr(
      {
        number: 1203,
        title: "Paginate customer events endpoint",
        repo: "api",
        draft: true,
        checks: "PENDING",
        additions: 58,
        deletions: 4,
      },
      144,
    ),
  ]
  return { review, reviewTotal: review.length, mine, mineTotal: mine.length }
}

const STORIES: Array<[string, string, number, number, number]> = [
  ["Show HN: A tiny SQLite-backed job queue in 300 lines", "github.com", 412, 128, 3],
  ["The case for boring infrastructure", "blog.jim.dev", 388, 214, 5],
  ["Rust 1.92 released", "blog.rust-lang.org", 351, 97, 4],
  ["How we cut our CI time from 40 to 6 minutes", "engineering.example.com", 297, 143, 6],
  ["A visual guide to CRDTs", "lab.sync.page", 264, 61, 7],
  ["Ask HN: What are you using for personal dashboards?", "news.ycombinator.com", 233, 302, 8],
  ["Reverse-engineering a 1990s pocket synth", "hackaday.io", 198, 42, 2],
  ["Postgres 19 beta: what is new for analytics", "postgresql.org", 176, 58, 9],
  ["Why your type checker is slow", "nicole.codes", 154, 77, 10],
  ["The quiet death of the RSS reader (and its comeback)", "theverge.example", 141, 189, 11],
  ["Launch HN: Tracewell (YC F26) – Session replay for CLIs", "tracewell.dev", 122, 66, 3],
  ["Designing a keyboard-first email client", "mailcraft.dev", 109, 38, 12],
  ["Show HN: I built a browser homepage that only shows what matters today", "github.com", 104, 51, 4],
  ["The hidden cost of feature flags", "martinfowler.com", 98, 44, 13],
  ["Notes on running a one-person SaaS for ten years", "indie.example", 91, 63, 6],
  ["An interactive intro to signal processing", "dsp.page", 88, 19, 14],
  ["Linux 7.4 merges new scheduler", "lwn.net", 85, 71, 9],
  ["Ask HN: How do you keep up with code review?", "news.ycombinator.com", 80, 112, 5],
  ["Writing a tiny Lisp in Zig", "ziglang.example", 74, 22, 15],
  ["What I learned building a font from scratch", "type.example", 69, 17, 16],
  ["The economics of open-source maintainership", "oss.example", 66, 95, 11],
  ["SQLite's new JSONB functions, explained", "sqlite.org", 61, 14, 17],
  ["A field guide to flaky tests", "testing.example", 57, 28, 18],
  ["Show HN: A terminal UI for GitHub notifications", "github.com", 52, 21, 7],
]

export function demoHN(): Array<Story> {
  return STORIES.map(([title, domain, points, comments, hoursAgo], i) => ({
    id: 1000 + i,
    title,
    url: `https://${domain}/`,
    domain,
    points,
    comments,
    time: Date.now() - hoursAgo * HOUR,
    discussion: `https://news.ycombinator.com/item?id=${1000 + i}`,
  }))
}

export const demoViewer: Viewer = { login: "alex", name: "Alex" }
