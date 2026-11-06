import { type CSSProperties, useMemo } from "react"
import { age, synced } from "../lib/format"
import type { LinearIssue, LinearIssues, PullRequests } from "../lib/types"
import { type Facet, useFacetFilter } from "../lib/useFacetFilter"
import { useNow } from "../lib/useNow"
import { LinearIcon, PriorityIcon, PullRequestIcon } from "./icons"
import { Panel, PanelError, PanelFallback } from "./Panel"
import { FilterMenu } from "./ui/FilterMenu"
import { PopIn, SwapText } from "./ui/motion"

interface Props {
  linear: LinearIssues | undefined
  prs: PullRequests | undefined
  fetchedAt: number | undefined
  error: unknown
}

export function LinearPanel({ linear, prs, fetchedAt, error }: Props) {
  const now = useNow()
  // Issue ID -> one of your PRs that names it, from the IDs the PR column already parses.
  const prFor = useMemo(() => {
    const map = new Map<string, string>()
    for (const pr of [...(prs?.mine ?? []), ...(prs?.review ?? [])]) if (pr.linear) map.set(pr.linear.id, pr.url)
    return map
  }, [prs])

  return (
    <Panel id="linear" icon={<LinearIcon />} title="My issues" meta={<SwapText text={synced(fetchedAt, now)} />}>
      <Body linear={linear} error={error} prFor={prFor} now={now} />
    </Panel>
  )
}

function Body({
  linear,
  error,
  prFor,
  now,
}: {
  linear: LinearIssues | undefined
  error: unknown
  prFor: Map<string, string>
  now: number
}) {
  if (!linear) return <PanelFallback error={error} />
  if (!linear.configured) {
    return (
      <p className="panel-empty">
        Add <code>LINEAR_API_KEY</code> to <code>.env</code> to see your issues.
      </p>
    )
  }
  return (
    <>
      {error != null && <PanelError error={error} />}
      <Section
        id="started"
        title="In progress"
        issues={linear.issues.filter((i) => i.state.type === "started")}
        prFor={prFor}
        now={now}
      />
      <Section
        id="unstarted"
        title="Todo"
        issues={linear.issues.filter((i) => i.state.type === "unstarted")}
        prFor={prFor}
        now={now}
      />
    </>
  )
}

const NONE = "No project"

const FACETS: Array<Facet<LinearIssue>> = [
  {
    key: "project",
    label: "Project",
    get: (i) => i.project?.name ?? NONE,
    always: true,
  },
  { key: "status", label: "Status", get: (i) => i.state.name },
  { key: "priority", label: "Priority", get: (i) => i.priorityLabel },
  { key: "team", label: "Team", get: (i) => i.team },
]

/** Urgent first, "No priority" last, then most recently touched. */
function byPriority(a: LinearIssue, b: LinearIssue) {
  const rank = (p: number) => (p === 0 ? 5 : p)
  return rank(a.priority) - rank(b.priority) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
}

function Section({
  id,
  title,
  issues,
  prFor,
  now,
}: {
  id: string
  title: string
  issues: Array<LinearIssue>
  prFor: Map<string, string>
  now: number
}) {
  // Project swatches need the colors, which only the issues carry.
  const facets = useMemo(() => {
    const colors = new Map(issues.map((i) => [i.project?.name ?? NONE, i.project?.color]))
    return FACETS.map((f) =>
      f.key === "project"
        ? { ...f, leading: (name: string) => <i className="repo-swatch" style={projectStyle(colors.get(name))} /> }
        : f,
    )
  }, [issues])
  const filter = useFacetFilter(`linear-filter:${id}`, issues, facets)
  const sorted = useMemo(() => [...filter.visible].sort(byPriority), [filter.visible])

  return (
    <div className="pr-section">
      <h3 className="pr-section-head">
        {title}
        <span className="count">
          <PopIn value={filter.filtering ? `${sorted.length}/${issues.length}` : String(issues.length)} />
        </span>
        <span className="pr-section-actions">
          <FilterMenu
            label={`Filter ${title}`}
            facets={filter.facets}
            value={filter.value}
            onChange={filter.onChange}
          />
        </span>
      </h3>
      {sorted.length ? (
        <ul className="pr-list">
          {sorted.map((issue) => (
            <Row key={issue.id} issue={issue} pr={prFor.get(issue.id)} now={now} />
          ))}
        </ul>
      ) : (
        <p className="panel-empty">{filter.filtering ? "Nothing matches these filters." : "Nothing here."}</p>
      )}
    </div>
  )
}

function projectStyle(color: string | undefined) {
  return { "--project": color ?? "var(--muted)" } as CSSProperties
}

function Row({ issue, pr, now }: { issue: LinearIssue; pr: string | undefined; now: number }) {
  return (
    <li>
      <div className="pr issue">
        <i
          className="issue-state"
          data-type={issue.state.type}
          style={{ "--state": issue.state.color } as CSSProperties}
          title={issue.state.name}
        />
        <span className="pr-main">
          <span className="pr-head">
            <span className="pr-linear mono">{issue.id}</span>
            <a className="pr-title pr-link" href={issue.url} target="_blank" rel="noreferrer">
              {issue.title}
            </a>
          </span>
          <span className="pr-meta">
            {issue.project && (
              <span className="project-badge" style={projectStyle(issue.project.color)}>
                {issue.project.name}
              </span>
            )}
            <span>{issue.state.name}</span>
            <span className="mono">{age(Date.parse(issue.updatedAt), now)}</span>
          </span>
        </span>
        <span className="pr-side issue-side">
          <span className="priority" title={issue.priorityLabel}>
            <PriorityIcon priority={issue.priority} />
          </span>
          {pr && (
            <a className="issue-pr" href={pr} target="_blank" rel="noreferrer" title="Open the linked PR">
              <PullRequestIcon width={11} height={11} /> PR
            </a>
          )}
        </span>
      </div>
    </li>
  )
}
