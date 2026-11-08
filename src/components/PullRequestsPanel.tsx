import { useQueryClient } from "@tanstack/react-query"
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react"
import { age, prSize, signed, synced } from "../lib/format"
import { repoHues } from "../lib/repoColor"
import type { PrNotification, PullRequest, PullRequests } from "../lib/types"
import type { Facet } from "../lib/useFacetFilter"
import { useNow } from "../lib/useNow"
import type { Cached } from "../server/cache"
import { dismissNotification, refreshPRs } from "../server/fns"
import { FilteredSection } from "./FilteredSection"
import { ActivityIcon, AtIcon, CommentIcon, GitHubIcon, HourglassIcon, PullRequestIcon } from "./icons"
import { Panel, PanelError, PanelFallback } from "./Panel"
import { RowSignals, type Signal } from "./RowSignals"
import { SwapText } from "./ui/motion"
import { RefreshButton } from "./ui/RefreshButton"

interface Props {
  prs: PullRequests | undefined
  notifications: Array<PrNotification> | undefined
  fetchedAt: number | undefined
  error: unknown
}

export function PullRequestsPanel({ prs, notifications, fetchedAt, error }: Props) {
  const now = useNow()
  const notificationSignals = useNotificationSignals(notifications)
  const staleSignals = useStaleSignals(now)
  const reviewSignals = (pr: PullRequest) => [...notificationSignals(pr), ...staleSignals(pr)]
  // One map for both sections, so a repo has the same color in each.
  const hues = useMemo(() => repoHues([...(prs?.review ?? []), ...(prs?.mine ?? [])].map((pr) => pr.repoFull)), [prs])
  return (
    <Panel
      id="prs"
      icon={<GitHubIcon />}
      title="Pull requests"
      meta={
        <span className="panel-sync">
          <SwapText text={synced(fetchedAt, now)} />
          <RefreshButton queryKey={["prs"]} refresh={refreshPRs} what="pull requests" />
        </span>
      }
    >
      {!prs ? (
        <PanelFallback error={error} />
      ) : (
        <>
          {error != null && <PanelError error={error} />}
          <Section
            id="review"
            title="Review requested"
            prs={prs.review}
            total={prs.reviewTotal}
            badgeFor={reviewBadge}
            hues={hues}
            now={now}
            signalsFor={reviewSignals}
            tone="attention"
            showAuthor
          />
          <Section
            id="mine"
            title="Yours"
            prs={prs.mine}
            total={prs.mineTotal}
            badgeFor={ownBadge}
            hues={hues}
            now={now}
            signalsFor={notificationSignals}
          />
        </>
      )}
    </Panel>
  )
}

type Badge = { label: string; tone: "blue" | "pink" | "green" | "red" | "gray" }

function reviewBadge(pr: PullRequest): Badge {
  return pr.reviewedByMe ? { label: "Re-review", tone: "pink" } : { label: "Your review", tone: "blue" }
}

function ownBadge(pr: PullRequest): Badge {
  if (pr.draft) return { label: "Draft", tone: "gray" }
  if (pr.review === "APPROVED") return { label: "Approved", tone: "green" }
  if (pr.review === "CHANGES_REQUESTED") return { label: "Changes requested", tone: "red" }
  return { label: "In review", tone: "gray" }
}

const CHECKS: Record<NonNullable<PullRequest["checks"]>, { label: string; tone: string }> = {
  SUCCESS: { label: "Checks pass", tone: "ok" },
  FAILURE: { label: "Checks failing", tone: "fail" },
  ERROR: { label: "Checks failing", tone: "fail" },
  PENDING: { label: "Running", tone: "pending" },
  EXPECTED: { label: "Running", tone: "pending" },
}

function Section({
  id,
  title,
  prs,
  total,
  badgeFor,
  hues,
  now,
  signalsFor,
  tone,
  showAuthor,
}: {
  id: string
  title: string
  prs: Array<PullRequest>
  total: number
  badgeFor: (pr: PullRequest) => Badge
  hues: Map<string, number>
  now: number
  signalsFor: (pr: PullRequest) => Array<Signal>
  tone?: "attention"
  showAuthor?: boolean
}) {
  const facets = useMemo(() => prFacets(badgeFor, hues), [badgeFor, hues])
  return (
    <FilteredSection
      storageKey={`prs-filter:${id}`}
      title={title}
      items={prs}
      total={total}
      facets={facets}
      tone={tone}
      getKey={(pr) => pr.url}
      render={(pr) => (
        <Row
          pr={pr}
          now={now}
          badge={badgeFor(pr)}
          hue={hues.get(pr.repoFull)}
          signals={signalsFor(pr)}
          showAuthor={showAuthor}
        />
      )}
    />
  )
}

/** How a PR section can be filtered. Options come only from the PRs in the list. */
function prFacets(badgeFor: (pr: PullRequest) => Badge, hues: Map<string, number>): Array<Facet<PullRequest>> {
  return [
    {
      key: "repo",
      label: "Repository",
      get: (pr) => pr.repoFull,
      optionLabel: shortRepo,
      leading: (repo) => <i className="repo-swatch" style={hueStyle(hues.get(repo))} />,
      always: true,
    },
    { key: "author", label: "Author", get: (pr) => pr.author },
    { key: "status", label: "Status", get: (pr) => badgeFor(pr).label },
    { key: "checks", label: "Checks", get: (pr) => (pr.checks ? CHECKS[pr.checks].label : "No checks") },
  ]
}

/** "org/repo" -> "repo", unless two orgs share that repo name. */
function shortRepo(full: string, all: Array<string>) {
  const name = full.split("/").pop() ?? full
  return all.filter((v) => v.endsWith(`/${name}`)).length > 1 ? full : name
}

/** "CORE-123: Fix it" -> "Fix it", since the ID is shown as its own link. */
function withoutIssueId(title: string, id: string) {
  return title.startsWith(id) ? title.slice(id.length).replace(/^[\s:–—-]+/, "") : title
}

function hueStyle(hue: number | undefined) {
  return { "--repo-h": hue ?? 0 } as CSSProperties
}

function Row({
  pr,
  now,
  badge,
  hue,
  signals,
  showAuthor,
}: {
  pr: PullRequest
  now: number
  badge: Badge
  hue: number | undefined
  signals: Array<Signal>
  showAuthor?: boolean
}) {
  const checks = pr.checks ? CHECKS[pr.checks] : null
  // Not one big <a>: the Linear link can't nest inside it. The title link stretches over the row instead.
  return (
    <div className={`pr${pr.draft ? " is-draft" : ""}`}>
      <PullRequestIcon className="pr-icon" draft={pr.draft} />
      <span className="pr-main">
        <span className="pr-head">
          {pr.linear && (
            <a
              className="pr-linear mono"
              href={pr.linear.url}
              target="_blank"
              rel="noreferrer"
              title={`Open ${pr.linear.id} in Linear`}
            >
              {pr.linear.id}
            </a>
          )}
          <a
            className="pr-title pr-link"
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            title={pr.repoFull}
            data-nav-row
          >
            {pr.linear ? withoutIssueId(pr.title, pr.linear.id) : pr.title}
          </a>
        </span>
        <span className="pr-meta">
          <span className="repo-badge mono" style={hueStyle(hue)}>
            {pr.repo}#{pr.number}
          </span>
          {showAuthor && pr.author && <span className="mono">{pr.author}</span>}
          <span className="mono">{age(Date.parse(pr.updatedAt), now)}</span>
          {checks && (
            <span className={`checks checks-${checks.tone}`}>
              <i className="checks-dot" />
              {checks.label}
            </span>
          )}
        </span>
      </span>
      <span className="pr-side">
        <span className="pr-side-top">
          <RowSignals signals={signals} />
          <span className={`badge badge-${badge.tone}`}>{badge.label}</span>
        </span>
        <span className="pr-diff mono">
          <span className="add">{signed(pr.additions, "+")}</span>
          <span className="del">{signed(pr.deletions, "−")}</span>
          <span className="size">{prSize(pr.additions, pr.deletions)}</span>
        </span>
      </span>
    </div>
  )
}

const NOTIFICATION: Record<string, { icon: ReactNode; label: string }> = {
  comment: { icon: <CommentIcon />, label: "New comment" },
  author: { icon: <CommentIcon />, label: "New activity" },
  mention: { icon: <AtIcon />, label: "You were mentioned" },
  team_mention: { icon: <AtIcon />, label: "Your team was mentioned" },
  state_change: { icon: <ActivityIcon />, label: "Closed, merged or reopened" },
}

/**
 * Signals per PR from unread GitHub notifications. Dismissing hides the icon at once,
 * then marks the notification read on GitHub. If that fails, the next fetch brings it back.
 */
function useNotificationSignals(notifications: Array<PrNotification> | undefined) {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const byPr = new Map((notifications ?? []).map((n) => [n.prUrl, n]))
    const dismiss = (n: PrNotification) => {
      queryClient.setQueryData<Cached<Array<PrNotification>>>(
        ["notifications"],
        (old) => old && { ...old, data: old.data.filter((x) => x.threadId !== n.threadId) },
      )
      dismissNotification({ data: n.threadId })
        .then((fresh) => queryClient.setQueryData(["notifications"], fresh))
        .catch(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
    }
    return (pr: PullRequest): Array<Signal> => {
      const n = byPr.get(pr.url)
      const kind = n && NOTIFICATION[n.reason]
      if (!n || !kind) return []
      return [{ key: n.threadId, ...kind, tone: "info", onDismiss: () => dismiss(n) }]
    }
  }, [notifications, queryClient])
}

/** A review request with no activity for this long gets an hourglass. */
const STALE_MS = 3 * 60 * 60_000
const STALE_KEY = "stale-dismissed"

/**
 * Hourglass signals for review requests that sat for 3 h. Only the "Review requested"
 * section uses them. Dismissals are keyed by URL and updatedAt, so new activity
 * on the PR lets a later stale spell show again.
 */
function useStaleSignals(now: number) {
  // Read after mount, so server and client render the same first frame.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    try {
      setDismissed(new Set(JSON.parse(localStorage.getItem(STALE_KEY) ?? "[]")))
    } catch {}
  }, [])

  return (pr: PullRequest): Array<Signal> => {
    const key = `${pr.url}@${pr.updatedAt}`
    const updated = Date.parse(pr.updatedAt)
    if (pr.reviewedByMe || now - updated < STALE_MS || dismissed.has(key)) return []
    const dismiss = () =>
      setDismissed((prev) => {
        const next = new Set(prev).add(key)
        // Old entries only match PRs that have moved on, so keep the newest few.
        localStorage.setItem(STALE_KEY, JSON.stringify([...next].slice(-200)))
        return next
      })
    return [
      {
        key: "stale",
        icon: <HourglassIcon />,
        label: `Waiting on you, no activity for ${age(updated, now)}`,
        tone: "warn",
        onDismiss: dismiss,
      },
    ]
  }
}
