import { useQuery } from "@tanstack/react-query"
import { useRef } from "react"
import { age, prSize, signed } from "../lib/format"
import { TTL } from "../lib/ttl"
import type { PullRequest } from "../lib/types"
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
              detail?.checks.map((check) => (
                <div className="pr-check" key={`${check.name}-${check.url}`}>
                  <span>
                    {check.url ? (
                      <a href={check.url} target="_blank" rel="noreferrer">
                        {check.name}
                      </a>
                    ) : (
                      check.name
                    )}
                  </span>
                  <span>{check.status.replaceAll("_", " ")}</span>
                </div>
              ))
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
                <ul className="pr-activity">
                  {detail.activity.map((item) => (
                    <li key={item.id}>
                      <p className="hn-meta">
                        <strong>{item.author}</strong>
                        <span>{item.kind}</span>
                        <a href={item.url} target="_blank" rel="noreferrer">
                          {age(Date.parse(item.at), now)}
                        </a>
                      </p>
                      {item.body && <PRMarkdown html={item.body} />}
                    </li>
                  ))}
                </ul>
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
