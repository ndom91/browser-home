import { useQuery } from "@tanstack/react-query"
import { useRef } from "react"
import { age, prSize, signed } from "../lib/format"
import { TTL } from "../lib/ttl"
import type { PRActivity, PRDetail, PullRequest } from "../lib/types"
import { useNow } from "../lib/useNow"
import { getPRDetail } from "../server/fns"
import { ArrowLeftIcon, ArrowUpRightIcon } from "./icons"
import { PanelError, PanelLoading } from "./Panel"

export function PRDetailView({
  pr,
  reviewRequested,
  reviewHref,
  onBack,
}: {
  pr: PullRequest
  reviewRequested: boolean
  reviewHref: string
  onBack: () => void
}) {
  const now = useNow()
  const contentRef = useRef<HTMLElement>(null)
  const key = `${pr.repoFull}/${pr.number}`
  const query = useQuery({
    queryKey: ["pr-detail", key],
    queryFn: () => getPRDetail({ data: key }),
    staleTime: TTL.prDetail,
  })
  const detail = query.data?.data
  const goTo = (id: string) => {
    const container = contentRef.current
    const target = container?.querySelector<HTMLElement>(`[data-detail-section="${id}"]`)
    if (container && target)
      container.scrollTo({
        top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top,
        behavior: "instant",
      })
    container?.focus({ preventScroll: true })
  }
  return (
    <div className="pr-detail">
      <header className="pr-detail-header">
        <nav className="hn-crumbs" aria-label="Pull request navigation">
          <button type="button" className="hn-back" data-detail-back onClick={onBack}>
            <ArrowLeftIcon /> Back
          </button>
          <a className="hn-open" href={pr.url} target="_blank" rel="noreferrer">
            Open on GitHub <ArrowUpRightIcon />
          </a>
        </nav>
        <div className="pr-detail-heading">
          <div className="pr-detail-repo">
            <span className="mono">
              {pr.repoFull}#{pr.number}
            </span>
            {pr.linear && (
              <a className="pr-detail-issue mono" href={pr.linear.url} target="_blank" rel="noreferrer">
                {pr.linear.id}
              </a>
            )}
          </div>
          <h3>{pr.title}</h3>
          <div className="pr-detail-byline">
            <span>{pr.author ?? "Unknown author"}</span>
            <span>·</span>
            <span>updated {age(Date.parse(pr.updatedAt), now)}</span>
            <span className="pr-detail-diff mono">
              <span className="add">{signed(pr.additions, "+")}</span>{" "}
              <span className="del">{signed(pr.deletions, "−")}</span>{" "}
              <span className="size" data-size={prSize(pr.additions, pr.deletions)}>
                {prSize(pr.additions, pr.deletions)}
              </span>
            </span>
          </div>
          <div className="pr-review-bar">
            <span
              className={`checks-dot ${reviewRequested ? "is-pending" : pr.review === "APPROVED" ? "is-success" : pr.review === "CHANGES_REQUESTED" ? "is-failed" : ""}`}
            />
            <span className="pr-review-label">
              {reviewRequested
                ? pr.reviewedByMe
                  ? "Your re-review requested"
                  : "Your review requested"
                : pr.draft
                  ? "Draft"
                  : (pr.review?.replaceAll("_", " ").toLowerCase() ?? "Open")}
              {!reviewRequested && detail?.reviewers.length ? ` · requested: ${detail.reviewers.join(", ")}` : ""}
            </span>
            {reviewRequested && (
              <span className="pr-review-actions">
                <a
                  href={`${pr.url}/files`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open GitHub to approve this pull request"
                >
                  Approve
                </a>
                <a className="pr-review-primary" href={reviewHref} aria-label="Review pull request in T3 Code">
                  Review
                </a>
              </span>
            )}
          </div>
          <div className="pr-detail-status">
            <div className="pr-status-line">
              <span
                className={`checks-dot ${pr.checks === "FAILURE" || pr.checks === "ERROR" ? "is-failed" : pr.checks === "SUCCESS" ? "is-success" : "is-pending"}`}
              />
              <strong>{pr.checks ? `Checks: ${pr.checks.toLowerCase()}` : "No checks"}</strong>
            </div>
            {detail?.checksError ? (
              <p className="panel-error">Could not load check details.</p>
            ) : (
              detail && <Checks checks={detail.checks} total={detail.checksTotal} />
            )}
          </div>
        </div>
        <nav className="pr-detail-sections" aria-label="Pull request sections">
          <button type="button" onClick={() => goTo("description")}>
            Description
          </button>
          <button type="button" onClick={() => goTo("activity")}>
            Activity{detail && !detail.activityError ? ` ${detail.activity.length}` : ""}
          </button>
          <button type="button" onClick={() => goTo("files")}>
            Files{detail && !detail.filesError ? ` ${detail.files.length}${detail.filesMore ? "+" : ""}` : ""}
          </button>
        </nav>
      </header>
      {/* The scroll region needs keyboard focus for native scrolling. */}
      <section
        ref={contentRef}
        className="pr-detail-content"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users need to reach the scroll region.
        tabIndex={0}
        aria-label="Pull request description and activity"
        data-nav-scroll
      >
        {!detail ? (
          query.error ? (
            <PanelError error={query.error} />
          ) : (
            <PanelLoading />
          )
        ) : (
          <>
            <section className="pr-detail-section" data-detail-section="description">
              <h4>Description</h4>
              {detail.description ? (
                <PRMarkdown html={detail.description} />
              ) : (
                <p className="panel-empty">No description.</p>
              )}
            </section>
            <section className="pr-detail-section" data-detail-section="activity">
              <h4>Activity</h4>
              {detail.activityError ? (
                <p className="panel-error">Could not load activity. Open on GitHub to see it.</p>
              ) : detail.activity.length === 0 ? (
                <p className="panel-empty">No activity yet.</p>
              ) : (
                <Activity items={detail.activity} now={now} />
              )}
              {detail.activityMore && (
                <p className="panel-empty">Some activity is omitted. See the full history on GitHub.</p>
              )}
            </section>
            <section className="pr-detail-section" data-detail-section="files">
              <h4>Files changed</h4>
              {detail.filesError ? (
                <p className="panel-error">Could not load files. Open on GitHub to see them.</p>
              ) : detail.files.length === 0 ? (
                <p className="panel-empty">No changed files.</p>
              ) : (
                <ul className="pr-files">
                  {detail.files.map((file) => (
                    <li key={file.path}>
                      <a href={file.url} target="_blank" rel="noreferrer">
                        {file.path}
                      </a>
                      <span className="mono">
                        <span className="add">{signed(file.additions, "+")}</span>{" "}
                        <span className="del">{signed(file.deletions, "−")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {detail.filesMore && <p className="panel-empty">Showing the first 100 files. See the rest on GitHub.</p>}
            </section>
          </>
        )}
      </section>
    </div>
  )
}

function PRMarkdown({ html }: { html: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: GitHub HTML is sanitized on the server.
  return <div className="pr-detail-markdown" dangerouslySetInnerHTML={{ __html: html }} />
}

function Checks({ checks, total }: { checks: PRDetail["checks"]; total: number }) {
  const passing = checks.filter((check) => check.status === "success")
  const other = checks.filter((check) => check.status !== "success")
  return (
    <>
      {other.map((check) => (
        <CheckRow key={check.id} check={check} />
      ))}
      {passing.length > 0 && (
        <details className="pr-passing-checks">
          <summary>
            <span className="checks-dot is-success" />
            {passing.length} passing
          </summary>
          {passing.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </details>
      )}
      {total > checks.length && (
        <p className="pr-check-note">
          Showing {checks.length} of {total} checks. See GitHub for all checks.
        </p>
      )}
    </>
  )
}

function CheckRow({ check }: { check: PRDetail["checks"][number] }) {
  const tone =
    check.status === "success"
      ? "is-success"
      : ["failure", "timed_out", "action_required", "startup_failure"].includes(check.status)
        ? "is-failed"
        : ["queued", "in_progress", "pending", "requested", "waiting"].includes(check.status)
          ? "is-pending"
          : ""
  const seconds = check.durationMs == null ? null : Math.round(check.durationMs / 1000)
  const duration =
    seconds == null
      ? null
      : seconds < 60
        ? `${seconds}s`
        : seconds < 3600
          ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
          : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return (
    <div className="pr-check">
      <span className="pr-check-name">
        <span className={`checks-dot ${tone}`} />
        {check.url ? (
          <a href={check.url} target="_blank" rel="noreferrer">
            {check.name} <ArrowUpRightIcon className="pr-check-external" />
          </a>
        ) : (
          check.name
        )}
      </span>
      <span>
        {check.status.replaceAll("_", " ")}
        {duration && ` · ${duration}`}
      </span>
    </div>
  )
}

function Activity({ items, now }: { items: Array<PRActivity>; now: number }) {
  const groups = [
    { label: "Open", items: items.filter((item) => item.thread && !item.thread.resolved) },
    { label: "Resolved", items: items.filter((item) => item.thread?.resolved) },
    { label: "Conversation", items: items.filter((item) => !item.thread) },
  ]
  return (
    <div className="pr-activity">
      {groups.map(
        (group) =>
          group.items.length > 0 && (
            <section className="pr-activity-group" key={group.label}>
              <h5>
                {group.label}
                {group.label !== "Conversation" && ` · ${group.items.length}`}
              </h5>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <details className="pr-activity-item" open={item.isBot || item.thread?.resolved ? undefined : true}>
                      <summary>
                        <span className={`pr-activity-avatar${item.isBot ? " is-bot" : ""}`} aria-hidden="true">
                          {item.author.slice(0, 2)}
                        </span>
                        <strong>{item.author.replace(/\[bot\]$/, "")}</strong>
                        {!item.thread && item.kind !== "Comment" && (
                          <span className="pr-activity-kind">{item.kind}</span>
                        )}
                        <span className="pr-activity-preview">
                          {item.preview.trim().replace(/\s+/g, " ") ||
                            (item.thread || item.kind === "Comment" ? item.kind : "")}
                        </span>
                        {item.thread?.resolved && (
                          <span className="pr-activity-resolved" role="img" aria-label="Resolved">
                            ✓
                          </span>
                        )}
                        <span className="pr-activity-age">{age(Date.parse(item.at), now)}</span>
                        <span className="pr-activity-chevron" aria-hidden="true">
                          ⌄
                        </span>
                      </summary>
                      <div className="pr-activity-body">
                        {item.thread && <p className="pr-activity-path">{item.thread.path}</p>}
                        {item.body && <PRMarkdown html={item.body} />}
                        <a className="pr-activity-link" href={item.url} target="_blank" rel="noreferrer">
                          View on GitHub <ArrowUpRightIcon />
                        </a>
                        {item.thread?.replies.map((reply) => (
                          <div className="pr-activity-reply" key={reply.id}>
                            <p>
                              <strong>{reply.author}</strong> ·{" "}
                              <a href={reply.url} target="_blank" rel="noreferrer">
                                {age(Date.parse(reply.at), now)}
                              </a>
                            </p>
                            {reply.body && <PRMarkdown html={reply.body} />}
                          </div>
                        ))}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  )
}
