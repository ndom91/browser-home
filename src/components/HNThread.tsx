import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { age, plural } from "../lib/format"
import { countComments, itemUrl } from "../lib/hn"
import { TTL } from "../lib/ttl"
import type { HNComment, HNThread as HNThreadData, Story } from "../lib/types"
import { useNow } from "../lib/useNow"
import { getHNThread } from "../server/fns"
import { ArrowLeftIcon, ArrowUpRightIcon } from "./icons"
import { PanelError, PanelLoading } from "./Panel"

export const threadQuery = (id: number) => ({
  queryKey: ["hn-thread", id],
  queryFn: () => getHNThread({ data: id }),
  staleTime: TTL.hnThread,
})

/** The comment view that replaces the story list inside the HN panel. */
export function HNThread({ story, onBack }: { story: Story; onBack: () => void }) {
  const now = useNow()
  const thread = useQuery(threadQuery(story.id))
  const data = thread.data?.data

  return (
    <>
      <nav className="hn-crumbs" aria-label="Breadcrumb">
        <button type="button" className="hn-back" onClick={onBack}>
          <ArrowLeftIcon /> Back
        </button>
        <a className="hn-open" href={itemUrl(story.id)} target="_blank" rel="noreferrer">
          Open on HN <ArrowUpRightIcon />
        </a>
      </nav>

      <header className="hn-story">
        <a className="hn-story-title" href={story.url} target="_blank" rel="noreferrer">
          {story.title}
        </a>
        <p className="hn-meta">
          <span>{story.domain}</span>
          <span>{plural(data?.points ?? story.points, "pt")}</span>
          {data && <span>{data.author}</span>}
          <span>{age(story.time, now)}</span>
          <span>{plural(data?.total ?? story.comments, "comment")}</span>
        </p>
        {data?.html && <Html className="hn-story-text" html={data.html} />}
      </header>

      <Comments thread={data} error={thread.error} now={now} />
    </>
  )
}

function Comments({ thread, error, now }: { thread: HNThreadData | undefined; error: unknown; now: number }) {
  if (!thread) return error ? <PanelError error={error} /> : <PanelLoading />
  if (thread.comments.length === 0) return <p className="panel-empty">No comments yet.</p>
  return (
    <ul className="hn-comments">
      {thread.comments.map((c) => (
        <Comment key={c.id} comment={c} op={thread.author} now={now} />
      ))}
    </ul>
  )
}

function Comment({ comment, op, now }: { comment: HNComment; op: string; now: number }) {
  const [collapsed, setCollapsed] = useState(false)
  const toggle = () => setCollapsed((c) => !c)

  // Body stays mounted so collapse can animate its height. inert keeps hidden links out of the tab order.
  return (
    <li className={`hn-c t-acc${collapsed ? " is-collapsed" : ""}`} data-open={!collapsed}>
      <p className="hn-c-meta">
        <span className={`hn-c-author${comment.author === op ? " is-op" : ""}`}>{comment.author}</span>
        <a className="hn-c-age" href={itemUrl(comment.id)} target="_blank" rel="noreferrer">
          {age(comment.time, now)}
        </a>
        <button type="button" className="hn-c-toggle" onClick={toggle} aria-expanded={!collapsed}>
          {collapsed ? `[+${1 + countComments(comment.children)}]` : "[–]"}
        </button>
      </p>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner" inert={collapsed}>
          <Html className="hn-c-text" html={comment.html} />
          {comment.children.length > 0 && (
            <div className="hn-c-replies">
              {/* The thread line doubles as a collapse target, like on Reddit. */}
              <button
                type="button"
                className="hn-c-guide"
                onClick={toggle}
                aria-label={`Collapse thread by ${comment.author}`}
              />
              <ul>
                {comment.children.map((c) => (
                  <Comment key={c.id} comment={c} op={op} now={now} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

function Html({ html, className }: { html: string; className: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized on the server, see src/server/sanitize.ts.
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
