import { type CSSProperties, useEffect, useMemo, useState } from "react"
import { age, prSize, signed, synced } from "../lib/format"
import { repoHues } from "../lib/repoColor"
import type { PullRequest, PullRequests } from "../lib/types"
import { useNow } from "../lib/useNow"
import { GitHubIcon, PullRequestIcon } from "./icons"
import { Panel, PanelError, PanelFallback } from "./Panel"
import { activeFilterCount, type FilterFacet, FilterMenu, type FilterState } from "./ui/FilterMenu"

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
    <Panel id="prs" icon={<GitHubIcon />} title="Pull requests" meta={synced(fetchedAt, now)}>
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
  const [filters, setFilters] = useStoredFilters(`prs-filter:${id}`)
  const facets = useMemo(() => buildFacets(prs, badgeFor, hues), [prs, badgeFor, hues])
  const effective = useMemo(() => pruneFilters(filters, facets), [filters, facets])
  const filtering = activeFilterCount(effective) > 0
  const visible = filtering ? prs.filter((pr) => matches(pr, effective, badgeFor)) : prs

  return (
    <div className="pr-section">
      <h3 className="pr-section-head">
        {title}
        <span className={`count${tone ? ` count-${tone}` : ""}`}>
          {filtering ? `${visible.length}/${total}` : total}
        </span>
        <span className="pr-section-actions">
          <FilterMenu label={`Filter ${title}`} facets={facets} value={effective} onChange={setFilters} />
        </span>
      </h3>
      {visible.length ? (
        <ul className="pr-list">
          {visible.map((pr) => (
            <Row
              key={pr.url}
              pr={pr}
              now={now}
              badge={badgeFor(pr)}
              hue={hues.get(pr.repoFull)}
              showAuthor={showAuthor}
            />
          ))}
        </ul>
      ) : (
        <p className="panel-empty">{filtering ? "Nothing matches these filters." : "Nothing here."}</p>
      )}
    </div>
  )
}

/** Each facet value as a function of a PR. Options come only from the PRs in the list. */
const FACETS: Array<{ key: string; label: string; get: (pr: PullRequest, badge: Badge) => string | null }> = [
  { key: "repo", label: "Repository", get: (pr) => pr.repoFull },
  { key: "author", label: "Author", get: (pr) => pr.author },
  { key: "status", label: "Status", get: (_, badge) => badge.label },
  { key: "checks", label: "Checks", get: (pr) => (pr.checks ? CHECKS[pr.checks].label : "No checks") },
]

function buildFacets(
  prs: Array<PullRequest>,
  badgeFor: (pr: PullRequest) => Badge,
  hues: Map<string, number>,
): Array<FilterFacet> {
  return FACETS.map(({ key, label, get }) => {
    const values = [...new Set(prs.map((pr) => get(pr, badgeFor(pr))).filter((v) => v != null))].sort()
    return {
      key,
      label,
      options: values.map((value) => ({
        value,
        label: key === "repo" ? shortRepo(value, values) : value,
        leading: key === "repo" ? <i className="repo-swatch" style={hueStyle(hues.get(value))} /> : undefined,
      })),
    }
  }).filter((f) => f.options.length > 1 || f.key === "repo")
}

function matches(pr: PullRequest, filters: FilterState, badgeFor: (pr: PullRequest) => Badge) {
  const badge = badgeFor(pr)
  return FACETS.every(({ key, get }) => {
    const wanted = filters[key]
    if (!wanted?.length) return true
    const v = get(pr, badge)
    return v != null && wanted.includes(v)
  })
}

/** Drop saved values that are no longer in the list, so a merged PR can't leave the section empty. */
function pruneFilters(filters: FilterState, facets: Array<FilterFacet>): FilterState {
  const out: FilterState = {}
  for (const f of facets) {
    const kept = (filters[f.key] ?? []).filter((v) => f.options.some((o) => o.value === v))
    if (kept.length) out[f.key] = kept
  }
  return out
}

/** "org/repo" -> "repo", unless two orgs share that repo name. */
function shortRepo(full: string, all: Array<string>) {
  const name = full.split("/").pop() ?? full
  return all.filter((v) => v.endsWith(`/${name}`)).length > 1 ? full : name
}

function hueStyle(hue: number | undefined) {
  return { "--repo-h": hue ?? 0 } as CSSProperties
}

/** Filters survive reloads. Read after mount so server and client render the same first frame. */
function useStoredFilters(key: string) {
  const [value, setValue] = useState<FilterState>({})
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setValue(JSON.parse(raw))
    } catch {}
  }, [key])
  const set = (next: FilterState) => {
    setValue(next)
    localStorage.setItem(key, JSON.stringify(next))
  }
  return [value, set] as const
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
  return (
    <li>
      <a className={`pr${pr.draft ? " is-draft" : ""}`} href={pr.url} title={pr.repoFull}>
        <PullRequestIcon className="pr-icon" draft={pr.draft} />
        <span className="pr-main">
          <span className="pr-title">{pr.title}</span>
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
      </a>
    </li>
  )
}
