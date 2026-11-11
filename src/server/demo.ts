// Fixture data matching the design mockups. Enable with BROWSER_HOME_DEMO=1.

import { renderHtml } from "@tanstack/markdown/html"
import type {
  CalendarEvent,
  HNThread,
  LinearIssues,
  PrNotification,
  PullRequest,
  PullRequests,
  Standup,
  Story,
  Viewer,
  Weather,
} from "../lib/types"
import { sanitizePRHtml } from "./prMarkdown"

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
      // Right after the design review, so the standup card shows in the demo.
      ...at(30, 15),
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
    linear: null,
    ...p,
  }
}

export function demoPRs(): PullRequests {
  const review = [
    pr(
      {
        number: 4830,
        title: "[SUP-212] Fix SLA timer drift on snoozed threads",
        repo: "support-app",
        author: "mara",
        linear: { id: "SUP-212", url: "https://linear.app/acme/issue/SUP-212" },
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
        linear: { id: "SUP-198", url: "https://linear.app/acme/issue/SUP-198" },
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

// Mutable, so dismissing in demo mode sticks until the server restarts.
let notifications: Array<PrNotification> = [
  {
    threadId: "1",
    prUrl: "https://github.com/acme/support-app/pull/4797",
    reason: "comment",
    updatedAt: new Date().toISOString(),
  },
  {
    threadId: "2",
    prUrl: "https://github.com/acme/support-app/pull/4830",
    reason: "mention",
    updatedAt: new Date().toISOString(),
  },
]

export const demoNotifications = () => notifications

export function demoDismissNotification(threadId: string) {
  notifications = notifications.filter((n) => n.threadId !== threadId)
}

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

// Partly cloudy, as in the mockup.
export const demoWeather: Weather = { code: 2, max: 14, min: 6 }

export function demoThread(id: number): HNThread {
  const story = demoHN().find((s) => s.id === id) ?? demoHN()[0]
  const at = (minAgo: number) => Date.now() - minAgo * 60_000
  return {
    id,
    title: story.title,
    url: story.url,
    domain: story.domain,
    author: "pg",
    points: story.points,
    time: story.time,
    html: null,
    total: 4,
    comments: [
      {
        id: 1,
        author: "dang",
        time: at(42),
        html: '<p>This is a great writeup. The <i>boring</i> parts are the point.</p><p>See <a href="https://example.com" target="_blank" rel="noreferrer">the docs</a>.</p>',
        children: [
          {
            id: 2,
            author: "pg",
            time: at(30),
            html: "<p>Agreed. Here is the snippet:</p><pre><code>SELECT * FROM jobs WHERE run_at &lt; now();</code></pre>",
            children: [
              { id: 3, author: "tptacek", time: at(12), html: "<p>Watch out for lock contention.</p>", children: [] },
            ],
          },
        ],
      },
      { id: 4, author: "patio11", time: at(25), html: "<p>Shipping beats perfect.</p>", children: [] },
    ],
  }
}

export function demoStandup(): Standup {
  const since = new Date(Date.now() - 24 * HOUR).toISOString()
  return {
    since,
    done: [
      {
        kind: "issue",
        id: "SUP-205",
        title: "Snooze presets in the thread menu",
        url: "https://linear.app/acme/issue/SUP-205",
        pr: "https://github.com/acme/support-app/pull/4790",
      },
      {
        kind: "pr",
        id: "api#1198",
        title: "Rate-limit the events export",
        url: "https://github.com/acme/api/pull/1198",
      },
    ],
    opened: [
      {
        kind: "pr",
        id: "support-app#4821",
        title: "Add keyboard shortcuts to thread composer",
        url: "https://github.com/acme/support-app/pull/4821",
      },
    ],
    inProgress: [
      {
        kind: "issue",
        id: "CORE-881",
        title: "SLA breach warnings in thread list",
        url: "https://linear.app/acme/issue/CORE-881",
      },
      {
        kind: "issue",
        id: "SUP-198",
        title: "Add keyboard shortcuts to thread composer",
        url: "https://linear.app/acme/issue/SUP-198",
      },
    ],
  }
}

export function demoLinear(): LinearIssues {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
  const started = { name: "In Progress", type: "started", color: "#f2c94c" } as const
  const review = { name: "In Review", type: "started", color: "#5e6ad2" } as const
  const todo = { name: "Todo", type: "unstarted", color: "#bec2c8" } as const
  const backlog = { name: "Backlog", type: "backlog", color: "#95a2b3" } as const
  const queues = { name: "Queue filters", color: "#4ea7fc" }
  const sla = { name: "SLA v2", color: "#f7a1c1" }
  const issue = (id: string, title: string, rest: Partial<LinearIssues["issues"][number]>) => ({
    id,
    title,
    url: `https://linear.app/acme/issue/${id}`,
    priority: 3,
    priorityLabel: "Medium",
    updatedAt: ago(3 * HOUR),
    state: todo,
    project: null,
    team: id.split("-")[0],
    cycle: 42,
    ...rest,
  })
  return {
    issues: [
      issue("SUP-198", "Add keyboard shortcuts to thread composer", {
        state: review,
        project: queues,
        priority: 2,
        priorityLabel: "High",
        updatedAt: ago(5 * HOUR),
      }),
      issue("SUP-214", "Saved views for queue filters", { state: started, project: queues, updatedAt: ago(40 * MIN) }),
      issue("CORE-881", "SLA breach warnings in thread list", {
        state: started,
        project: sla,
        priority: 1,
        priorityLabel: "Urgent",
        updatedAt: ago(2 * HOUR),
      }),
      issue("CORE-902", "Backfill SLA timers for snoozed threads", { project: sla, updatedAt: ago(26 * HOUR) }),
      issue("SUP-220", "Empty state for filtered queues", { project: queues, priority: 4, priorityLabel: "Low" }),
      issue("CORE-940", "Bulk snooze from the thread list", {
        state: backlog,
        project: queues,
        updatedAt: ago(9 * 24 * HOUR),
      }),
      issue("CORE-915", "Flaky test: workspace invite expiry", {
        priority: 0,
        priorityLabel: "No priority",
        cycle: null,
        updatedAt: ago(3 * 24 * HOUR),
      }),
    ],
  }
}

export function demoPRDetail(key: string): import("../lib/types").PRDetail {
  return {
    description: sanitizePRHtml(
      renderHtml(
        "## Summary\nImprove the queue filters and make it easier to find work.\n\n- Preserve the selected filters\n- Add keyboard support",
      ),
    ),
    files: [
      {
        path: "src/components/QueueFilters.tsx",
        status: "modified",
        additions: 32,
        deletions: 8,
        url: "https://github.com",
      },
      { path: "src/lib/filters.ts", status: "added", additions: 18, deletions: 0, url: "https://github.com" },
    ],
    filesMore: false,
    filesError: false,
    reviewers: ["priya", "sam"],
    activity: [
      {
        id: "1",
        kind: "Code comment",
        thread: { path: "src/components/QueueFilters.tsx", resolved: false, replies: [] },
        preview: "Could we also cover the empty state?",
        author: "priya",
        isBot: false,
        body: sanitizePRHtml(renderHtml("This looks good. Could we also cover the **empty state**?")),
        at: new Date(Date.now() - HOUR).toISOString(),
        url: "https://github.com",
      },
      {
        id: "resolved-thread",
        kind: "Code comment",
        thread: {
          path: "src/lib/filters.ts",
          resolved: true,
          replies: [
            {
              id: "reply-1",
              author: "alex",
              isBot: false,
              body: sanitizePRHtml(renderHtml("Fixed in the latest commit.")),
              preview: "Fixed in the latest commit.",
              at: new Date(Date.now() - 45 * MIN).toISOString(),
              url: "https://github.com",
            },
          ],
        },
        preview: "Should this handle empty filters?",
        author: "review-bot[bot]",
        isBot: true,
        body: sanitizePRHtml(renderHtml("Should this handle empty filters?")),
        at: new Date(Date.now() - 55 * MIN).toISOString(),
        url: "https://github.com",
      },
      {
        id: "empty-review",
        kind: "Review: commented",
        preview: "",
        author: "review-bot[bot]",
        isBot: true,
        body: "",
        at: new Date(Date.now() - 40 * MIN).toISOString(),
        url: "https://github.com",
      },
      {
        id: "empty-human-review",
        kind: "Review: commented",
        preview: "",
        author: "alex",
        isBot: false,
        body: "",
        at: new Date(Date.now() - 35 * MIN).toISOString(),
        url: "https://github.com",
      },
      {
        id: "2",
        kind: "Review: approved",
        preview: "Nice improvement!",
        author: "sam",
        isBot: false,
        body: sanitizePRHtml(
          renderHtml(
            "<!-- bot summary -->\n\n<h2>Confidence score: 5/5</h2>\n\nNice improvement!\n\n<details><summary>Review notes</summary>All checks passed.</details>",
            { allowHtml: true },
          ),
        ),
        at: new Date(Date.now() - 30 * MIN).toISOString(),
        url: "https://github.com",
      },
    ],
    activityMore: false,
    activityError: false,
    checks: key.endsWith("/4830")
      ? []
      : [
          { id: 1, name: "Tests", status: "failure", url: "https://github.com", durationMs: 125000 },
          { id: 2, name: "Lint", status: "success", url: "https://github.com", durationMs: 38000 },
          ...["Deploy", "Integration", "Release", "Publish", "Notifications", "Smoke tests"].map((name, index) => ({
            id: index + 3,
            name,
            status: "skipped",
            url: "https://github.com",
            durationMs: null,
          })),
        ],
    checksTotal: key.endsWith("/4830") ? 0 : 8,
    checksError: false,
  }
}
