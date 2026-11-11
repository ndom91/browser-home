import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useRef, useState } from "react"
import { age, prSize, signed } from "../lib/format"
import { TTL } from "../lib/ttl"
import type { PRActivity, PRDetail, PullRequest } from "../lib/types"
import { useNow } from "../lib/useNow"
import { getPRDetail } from "../server/fns"
import { ArrowLeftIcon, ArrowUpRightIcon, ChevronDownIcon } from "./icons"
import { PanelError, PanelLoading } from "./Panel"

type DetailSection = "description" | "activity" | "files"

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
  const programmaticScroll = useRef<number | null>(null)
  const [activeSection, setActiveSection] = useState<DetailSection>("description")
  const key = `${pr.repoFull}/${pr.number}`
  const query = useQuery({
    queryKey: ["pr-detail", key],
    queryFn: () => getPRDetail({ data: key }),
    staleTime: TTL.prDetail,
  })
  const detail = query.data?.data
  const goTo = (id: DetailSection) => {
    const container = contentRef.current
    const target = container?.querySelector<HTMLElement>(`[data-detail-section="${id}"]`)
    if (!container || !target) return
    setActiveSection(id)
    container.scrollTo({
      top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top,
      behavior: "instant",
    })
    programmaticScroll.current = container.scrollTop
    container.focus({ preventScroll: true })
  }
  const updateActiveSection = () => {
    const container = contentRef.current
    if (!container) return
    const expected = programmaticScroll.current
    programmaticScroll.current = null
    if (expected !== null && Math.abs(container.scrollTop - expected) < 1) return

    const sections = container.querySelectorAll<HTMLElement>("[data-detail-section]")
    if (container.scrollTop > 0 && container.scrollTop + container.clientHeight >= container.scrollHeight - 1) {
      setActiveSection("files")
      return
    }
    const top = container.getBoundingClientRect().top + 20
    let current: DetailSection = "description"
    for (const section of sections) {
      if (section.getBoundingClientRect().top > top) break
      current = section.dataset.detailSection as DetailSection
    }
    setActiveSection(current)
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
          <button
            type="button"
            aria-current={activeSection === "description" ? "location" : undefined}
            onClick={() => goTo("description")}
          >
            Description
          </button>
          <button
            type="button"
            aria-current={activeSection === "activity" ? "location" : undefined}
            onClick={() => goTo("activity")}
          >
            Activity{detail && !detail.activityError ? ` ${detail.activity.length}` : ""}
          </button>
          <button
            type="button"
            aria-current={activeSection === "files" ? "location" : undefined}
            onClick={() => goTo("files")}
          >
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
        onScroll={updateActiveSection}
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
              {detail.activityError && (
                <p className="panel-error">
                  Some activity could not be loaded. Open on GitHub to see the full history.
                </p>
              )}
              {detail.activity.length > 0 ? (
                <Activity items={detail.activity} now={now} />
              ) : !detail.activityError ? (
                <p className="panel-empty">No activity yet.</p>
              ) : null}
              {detail.activityMore && (
                <p className="panel-empty">Some activity is omitted. See the full history on GitHub.</p>
              )}
            </section>
            <section className="pr-detail-section" data-detail-section="files">
              <div className="pr-files-heading">
                <h4>
                  Files changed{" "}
                  {!detail.filesError && (
                    <span>
                      {detail.files.length}
                      {detail.filesMore ? "+" : ""}
                    </span>
                  )}
                </h4>
                <span className="mono pr-files-diff">
                  <span className="add">{signed(pr.additions, "+")}</span>{" "}
                  <span className={pr.deletions ? "del" : ""}>{signed(pr.deletions, "−")}</span>
                </span>
              </div>
              {detail.filesError ? (
                <p className="panel-error">Could not load files. Open on GitHub to see them.</p>
              ) : detail.files.length === 0 ? (
                <p className="panel-empty">No changed files.</p>
              ) : (
                <ul className="pr-files">
                  {detail.files.map((file) => {
                    const slash = file.path.lastIndexOf("/")
                    const name = file.path.slice(slash + 1)
                    const extension = name.indexOf(".", 1)
                    return (
                      <li key={file.path}>
                        <span
                          className="pr-file-status mono"
                          data-status={file.status}
                          aria-label={file.status}
                          role="img"
                        >
                          {file.status.charAt(0).toUpperCase()}
                        </span>
                        <a
                          className="pr-file-path mono"
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          title={file.path}
                          aria-label={file.path}
                        >
                          <span className="pr-file-name">
                            {extension < 0 ? name : name.slice(0, extension)}
                            {extension >= 0 && <span>{name.slice(extension)}</span>}
                          </span>
                          {slash >= 0 && (
                            <span className="pr-file-directory">
                              <bdi dir="ltr">{file.path.slice(0, slash + 1)}</bdi>
                            </span>
                          )}
                        </a>
                        <span className="mono pr-files-diff">
                          <span className={file.additions ? "add" : ""}>{signed(file.additions, "+")}</span>{" "}
                          <span className={file.deletions ? "del" : ""}>{signed(file.deletions, "−")}</span>
                        </span>
                      </li>
                    )
                  })}
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

const FAILED_CHECKS = ["failure", "timed_out", "action_required", "startup_failure"]
const RUNNING_CHECKS = ["queued", "in_progress", "pending", "requested", "waiting"]

function Checks({ checks, total }: { checks: PRDetail["checks"]; total: number }) {
  const priority = (status: string) =>
    RUNNING_CHECKS.includes(status) ? 0 : FAILED_CHECKS.includes(status) ? 1 : status === "success" ? 3 : 2
  const sorted = [...checks].sort((a, b) => priority(a.status) - priority(b.status))
  const visible = sorted.slice(0, 5)
  const remaining = sorted.slice(5)
  const groups = [
    { label: "passing", tone: "is-success", count: remaining.filter((check) => check.status === "success").length },
    { label: "skipped", count: remaining.filter((check) => check.status === "skipped").length },
    { label: "neutral", count: remaining.filter((check) => check.status === "neutral").length },
    {
      label: "failed",
      tone: "is-failed",
      count: remaining.filter((check) => FAILED_CHECKS.includes(check.status)).length,
    },
    {
      label: "running",
      tone: "is-pending",
      count: remaining.filter((check) => RUNNING_CHECKS.includes(check.status)).length,
    },
    {
      label: "other",
      count: remaining.filter(
        (check) => !["success", "skipped", "neutral", ...FAILED_CHECKS, ...RUNNING_CHECKS].includes(check.status),
      ).length,
    },
  ]
  return (
    <>
      {visible.map((check) => (
        <CheckRow key={check.id} check={check} />
      ))}
      {remaining.length > 0 && (
        <Accordion
          className="pr-more-checks"
          heading={
            <span className="pr-check-summary">
              {groups
                .filter((group) => group.count)
                .map((group) => (
                  <span className="pr-check-summary-group" key={group.label}>
                    <span className={`checks-dot ${group.tone ?? ""}`} aria-hidden="true" />
                    {group.count} {group.label}{" "}
                  </span>
                ))}
            </span>
          }
        >
          {remaining.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </Accordion>
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
      : FAILED_CHECKS.includes(check.status)
        ? "is-failed"
        : RUNNING_CHECKS.includes(check.status)
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
                    <Accordion
                      className="pr-activity-item"
                      defaultOpen={
                        !item.isBot &&
                        !item.thread?.resolved &&
                        Boolean(item.preview.trim() || item.thread?.replies.some((reply) => reply.preview.trim()))
                      }
                      heading={
                        <>
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
                        </>
                      }
                    >
                      <div className="pr-activity-body">
                        {item.thread && <p className="pr-activity-path">{item.thread.path}</p>}
                        {item.body ? <PRMarkdown html={item.body} /> : item.preview.trim() && <p>{item.preview}</p>}
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
                    </Accordion>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  )
}

function Accordion({
  className,
  heading,
  children,
  defaultOpen = false,
}: {
  className: string
  heading: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`t-acc ${className}`} data-open={open}>
      <button type="button" className="t-acc-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {heading}
        <ChevronDownIcon className="t-acc-chevron" />
      </button>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner" inert={!open}>
          {children}
        </div>
      </div>
    </div>
  )
}
