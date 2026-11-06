import { age, prSize, signed, synced } from "../lib/format"
import type { PullRequest, PullRequests } from "../lib/types"
import { useNow } from "../lib/useNow"
import { GitHubIcon, PullRequestIcon } from "./icons"
import { Panel, PanelError, PanelFallback } from "./Panel"

interface Props {
  prs: PullRequests | undefined
  fetchedAt: number | undefined
  error: unknown
}

export function PullRequestsPanel({ prs, fetchedAt, error }: Props) {
  const now = useNow()
  return (
    <Panel id="prs" icon={<GitHubIcon />} title="Pull requests" meta={synced(fetchedAt, now)}>
      {!prs ? (
        <PanelFallback error={error} />
      ) : (
        <>
          {error != null && <PanelError error={error} />}
          <Section title="Review requested" count={prs.reviewTotal} tone="attention">
            {prs.review.map((pr) => (
              <Row key={pr.url} pr={pr} now={now} badge={reviewBadge(pr)} showAuthor />
            ))}
          </Section>
          <Section title="Yours" count={prs.mineTotal}>
            {prs.mine.map((pr) => (
              <Row key={pr.url} pr={pr} now={now} badge={ownBadge(pr)} />
            ))}
          </Section>
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
  title,
  count,
  tone,
  children,
}: {
  title: string
  count: number
  tone?: "attention"
  children: Array<React.ReactNode>
}) {
  return (
    <div className="pr-section">
      <h3 className="pr-section-head">
        {title}
        <span className={`count${tone ? ` count-${tone}` : ""}`}>{count}</span>
      </h3>
      {children.length ? <ul className="pr-list">{children}</ul> : <p className="panel-empty">Nothing here.</p>}
    </div>
  )
}

function Row({ pr, now, badge, showAuthor }: { pr: PullRequest; now: number; badge: Badge; showAuthor?: boolean }) {
  const checks = pr.checks ? CHECKS[pr.checks] : null
  return (
    <li>
      <a className={`pr${pr.draft ? " is-draft" : ""}`} href={pr.url} title={pr.repoFull}>
        <PullRequestIcon className="pr-icon" draft={pr.draft} />
        <span className="pr-main">
          <span className="pr-title">{pr.title}</span>
          <span className="pr-meta">
            <span className="mono">
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
