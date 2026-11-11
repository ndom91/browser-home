import { Markdown } from "@tanstack/markdown/react"
import { useQuery } from "@tanstack/react-query"
import { age, signed } from "../lib/format"
import { TTL } from "../lib/ttl"
import type { PullRequest } from "../lib/types"
import { useNow } from "../lib/useNow"
import { getPRDetail } from "../server/fns"
import { ArrowLeftIcon, ArrowUpRightIcon } from "./icons"
import { PanelError, PanelLoading } from "./Panel"

export function PRDetailView({ pr, onBack }: { pr: PullRequest; onBack: () => void }) {
  const now = useNow()
  const key = `${pr.repoFull}/${pr.number}`
  const query = useQuery({
    queryKey: ["pr-detail", key],
    queryFn: () => getPRDetail({ data: key }),
    staleTime: TTL.prDetail,
  })
  const detail = query.data?.data
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
          <span className="mono">
            {pr.repoFull}#{pr.number}
          </span>
          <h3>{pr.title}</h3>
          <p className="hn-meta">
            <span>{pr.author ?? "Unknown author"}</span>
            <span>{pr.draft ? "Draft" : (pr.review?.replaceAll("_", " ").toLowerCase() ?? "Open")}</span>
            <span>Updated {age(Date.parse(pr.updatedAt), now)}</span>
          </p>
          <p className="hn-meta">
            <span>{pr.checks ? `Checks: ${pr.checks.toLowerCase()}` : "No checks"}</span>
            <span className="add">{signed(pr.additions, "+")}</span>
            <span className="del">{signed(pr.deletions, "−")}</span>
            {pr.linear && (
              <a href={pr.linear.url} target="_blank" rel="noreferrer">
                {pr.linear.id}
              </a>
            )}
          </p>
          {detail?.reviewers.length ? <p className="hn-meta">Requested: {detail.reviewers.join(", ")}</p> : null}
          {detail?.checksError ? (
            <p className="panel-error">Could not load check details.</p>
          ) : (
            detail?.checks.map((check) => (
              <p className="hn-meta" key={check.name}>
                {check.url ? (
                  <a href={check.url} target="_blank" rel="noreferrer">
                    {check.name}
                  </a>
                ) : (
                  check.name
                )}
                : {check.status}
              </p>
            ))
          )}
        </div>
      </header>
      {/* A focusable scroll region lets keyboard users read long activity. */}
      <section
        className="pr-detail-content"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the scroll region must be reachable by keyboard.
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
            <section className="pr-detail-section">
              <h4>Description</h4>
              {detail.description ? (
                <div className="pr-detail-markdown">
                  <Markdown>{detail.description}</Markdown>
                </div>
              ) : (
                <p className="panel-empty">No description.</p>
              )}
            </section>
            <section className="pr-detail-section">
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
                      {item.body && (
                        <div className="pr-detail-markdown">
                          <Markdown>{item.body}</Markdown>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {detail.activityMore && (
                <p className="panel-empty">Some activity is omitted. See the full history on GitHub.</p>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  )
}
