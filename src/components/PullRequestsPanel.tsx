import { type CSSProperties, useMemo } from "react"
import { age, prSize, signed, synced } from "../lib/format"
import { repoHues } from "../lib/repoColor"
import type { PullRequest, PullRequests } from "../lib/types"
import type { Facet } from "../lib/useFacetFilter"
import { useNow } from "../lib/useNow"
import { refreshPRs } from "../server/fns"
import { FilteredSection } from "./FilteredSection"
import { GitHubIcon, PullRequestIcon } from "./icons"
import { Panel, PanelError, PanelFallback } from "./Panel"
import { SwapText } from "./ui/motion"
import { RefreshButton } from "./ui/RefreshButton"

interface Props {
  prs: PullRequests | undefined
  fetchedAt: number | undefined
  error: unknown
}

export function PullRequestsPanel({ prs, fetchedAt, error }: Props) {
  const now = useNow()
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
        <Row pr={pr} now={now} badge={badgeFor(pr)} hue={hues.get(pr.repoFull)} showAuthor={showAuthor} />
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
  showAuthor,
}: {
  pr: PullRequest
  now: number
  badge: Badge
  hue: number | undefined
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
              title={`Open $pr.linear.idin Linear`}
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
        <span className={`badge badge-${badge.tone}`}>{badge.label}</span>
        <span className="pr-diff mono">
          <span className="add">{signed(pr.additions, "+")}</span>
          <span className="del">{signed(pr.deletions, "−")}</span>
          <span className="size">{prSize(pr.additions, pr.deletions)}</span>
        </span>
      </span>
    </div>
  )
}
