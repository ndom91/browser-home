import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { age, plural } from "../lib/format"
import { countComments, insertComment, itemUrl, readableUrl } from "../lib/hn"
import { TTL } from "../lib/ttl"
import type { HNComment, HNThread as HNThreadData, Story } from "../lib/types"
import { useNow } from "../lib/useNow"
import type { Cached } from "../server/cache"
import { getHNThread, postHNComment, upvoteHNComment } from "../server/fns"
import { ArrowLeftIcon, ArrowUpRightIcon } from "./icons"
import { PanelError, PanelLoading } from "./Panel"

const HN_LOGIN_URL = "https://news.ycombinator.com/login"
const FRESH_MS = 2400

type ComposerTarget = null | "story" | number

export const threadQuery = (id: number) => ({
  queryKey: ["hn-thread", id],
  queryFn: () => getHNThread({ data: id }),
  staleTime: TTL.hnThread,
})

/** The comment view that replaces the story list inside the HN panel. */
export function HNThread({
  story,
  onBack,
  commentingEnabled,
}: {
  story: Story
  onBack: () => void
  commentingEnabled: boolean
}) {
  const now = useNow()
  const queryClient = useQueryClient()
  const thread = useQuery(threadQuery(story.id))
  const data = thread.data?.data

  const [activeTarget, setActiveTarget] = useState<ComposerTarget>(null)
  const [draft, setDraft] = useState("")
  const [confirming, setConfirming] = useState<{ next: ComposerTarget } | null>(null)
  const [freshIds, setFreshIds] = useState<Set<number>>(() => new Set())
  const freshTimers = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(
    () => () => {
      for (const timer of freshTimers.current) clearTimeout(timer)
    },
    [],
  )

  const post = useMutation({
    mutationFn: ({ parentId, text }: { parentId: number; text: string; target: Exclude<ComposerTarget, null> }) =>
      postHNComment({ data: { parentId, text } }),
    onSuccess: (created, { target }) => {
      const comment: HNComment = { ...created, isYou: true }
      const parentCommentId = target === "story" ? null : target
      queryClient.setQueryData<Cached<HNThreadData>>(["hn-thread", story.id], (old) =>
        old
          ? {
              ...old,
              data: {
                ...old.data,
                comments: insertComment(old.data.comments, parentCommentId, comment),
                total: old.data.total + 1,
              },
            }
          : old,
      )
      queryClient.setQueryData<Cached<Array<Story>>>(["hn"], (old) =>
        old ? { ...old, data: old.data.map((s) => (s.id === story.id ? { ...s, comments: s.comments + 1 } : s)) } : old,
      )

      setFreshIds((prev) => new Set(prev).add(comment.id))
      const timer = setTimeout(() => {
        setFreshIds((prev) => {
          if (!prev.has(comment.id)) return prev
          const next = new Set(prev)
          next.delete(comment.id)
          return next
        })
      }, FRESH_MS)
      freshTimers.current.push(timer)

      setActiveTarget(null)
      setDraft("")
      setConfirming(null)
      post.reset()

      requestAnimationFrame(() => {
        scrollRef.current
          ?.querySelector<HTMLElement>(`[data-hn-comment="${comment.id}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" })
      })
    },
  })

  const switchTarget = (next: ComposerTarget) => {
    if (post.isPending) return
    const target = next === activeTarget ? null : next
    if (commentingEnabled && activeTarget !== null && draft.trim()) {
      setConfirming({ next: target })
      return
    }
    setActiveTarget(target)
    setDraft("")
    setConfirming(null)
    post.reset()
  }

  const cancelComposer = () => {
    if (post.isPending) return
    if (commentingEnabled && draft.trim()) {
      setConfirming({ next: null })
      return
    }
    setActiveTarget(null)
    setDraft("")
    setConfirming(null)
    post.reset()
  }

  const discardDraft = () => {
    const next = confirming?.next ?? null
    setActiveTarget(next)
    setDraft("")
    setConfirming(null)
    post.reset()
  }

  const submitComposer = () => {
    if (activeTarget === null || post.isPending || !draft.trim()) return
    setConfirming(null)
    const parentId = activeTarget === "story" ? story.id : activeTarget
    post.mutate({ parentId, text: draft, target: activeTarget })
  }

  const composerError = post.isError
    ? post.error instanceof Error
      ? post.error.message
      : "Couldn't post comment. Try again."
    : null

  return (
    <div className="hn-thread-view">
      <nav className="hn-crumbs" aria-label="Breadcrumb">
        <button type="button" className="hn-back" onClick={onBack}>
          <ArrowLeftIcon /> Back
        </button>
        <a className="hn-open" href={itemUrl(story.id)} target="_blank" rel="noreferrer">
          Open on HN <ArrowUpRightIcon />
        </a>
      </nav>

      <div className="hn-thread-scroll" ref={scrollRef}>
        <header className="hn-story">
          <a className="hn-story-title" href={readableUrl(story.url)} target="_blank" rel="noreferrer">
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

        <Comments
          thread={data}
          error={thread.error}
          now={now}
          commentingEnabled={commentingEnabled}
          activeTarget={activeTarget}
          freshIds={freshIds}
          draft={draft}
          onDraftChange={setDraft}
          isPending={post.isPending}
          composerError={composerError}
          confirming={confirming !== null}
          onReply={switchTarget}
          onCancel={cancelComposer}
          onKeep={() => setConfirming(null)}
          onDiscard={discardDraft}
          onSubmit={submitComposer}
        />
      </div>

      {data && (
        <div className="hn-bottom-bar">
          {!commentingEnabled ? (
            <a className="hn-composer-login" href={HN_LOGIN_URL} target="_blank" rel="noreferrer">
              Log in to HN to comment
            </a>
          ) : activeTarget === "story" ? (
            <Composer
              value={draft}
              onChange={setDraft}
              placeholder="Add a comment…"
              submitLabel="Comment"
              ariaLabel="Add a comment"
              isPending={post.isPending}
              error={composerError}
              confirming={confirming !== null}
              onCancel={cancelComposer}
              onKeep={() => setConfirming(null)}
              onDiscard={discardDraft}
              onSubmit={submitComposer}
            />
          ) : (
            <button type="button" className="hn-composer-collapsed" onClick={() => switchTarget("story")}>
              Add a comment…
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface CommentCallbacks {
  commentingEnabled: boolean
  activeTarget: ComposerTarget
  freshIds: Set<number>
  draft: string
  onDraftChange: (value: string) => void
  isPending: boolean
  composerError: string | null
  confirming: boolean
  onReply: (commentId: number) => void
  onCancel: () => void
  onKeep: () => void
  onDiscard: () => void
  onSubmit: () => void
}

function Comments({
  thread,
  error,
  now,
  ...callbacks
}: { thread: HNThreadData | undefined; error: unknown; now: number } & CommentCallbacks) {
  if (!thread) return error ? <PanelError error={error} /> : <PanelLoading />
  if (thread.comments.length === 0) return <p className="panel-empty">No comments yet.</p>
  return (
    <ul className="hn-comments">
      {thread.comments.map((c) => (
        <Comment key={c.id} comment={c} op={thread.author} now={now} {...callbacks} />
      ))}
    </ul>
  )
}

function Comment({
  comment,
  op,
  now,
  ...callbacks
}: { comment: HNComment; op: string; now: number } & CommentCallbacks) {
  const {
    commentingEnabled,
    activeTarget,
    freshIds,
    draft,
    onDraftChange,
    isPending,
    composerError,
    confirming,
    onReply,
    onCancel,
    onKeep,
    onDiscard,
    onSubmit,
  } = callbacks
  const [collapsed, setCollapsed] = useState(false)
  const toggle = () => setCollapsed((c) => !c)
  const upvote = useMutation({ mutationFn: () => upvoteHNComment({ data: comment.id }) })
  const isReplying = activeTarget === comment.id
  const isFresh = freshIds.has(comment.id)
  const rawAge = age(comment.time, now)
  const ageLabel = rawAge === "now" ? "just now" : rawAge
  const canReply = comment.author !== "[deleted]" && comment.id > 0
  const canUpvote = commentingEnabled && canReply && !comment.isYou

  // Body stays mounted so collapse can animate its height. inert keeps hidden links out of the tab order.
  return (
    <li className={`hn-c t-acc${collapsed ? " is-collapsed" : ""}`} data-open={!collapsed} data-hn-comment={comment.id}>
      <div className="hn-c-self t-acc" data-open={!collapsed} data-fresh={isFresh || undefined}>
        <p className="hn-c-meta">
          <span className={`hn-c-author${comment.isYou ? " is-you" : comment.author === op ? " is-op" : ""}`}>
            {comment.author}
          </span>
          {comment.isYou && <span className="hn-c-you">you</span>}
          {comment.id > 0 ? (
            <a className="hn-c-age" href={itemUrl(comment.id)} target="_blank" rel="noreferrer">
              {ageLabel}
            </a>
          ) : (
            <span className="hn-c-age">{ageLabel}</span>
          )}
          <button type="button" className="hn-c-toggle" onClick={toggle} aria-expanded={!collapsed} data-nav-row>
            {collapsed ? `[+${1 + countComments(comment.children)}]` : "[–]"}
          </button>
        </p>
        <div className="t-acc-panel">
          <div className="t-acc-panel-inner" inert={collapsed}>
            <Html className="hn-c-text" html={comment.html} />
            {canReply && (
              <>
                <div className="hn-c-actions">
                  <button
                    type="button"
                    className="hn-c-reply"
                    aria-expanded={isReplying}
                    data-active={isReplying || undefined}
                    onClick={() => onReply(comment.id)}
                  >
                    reply
                  </button>
                  {canUpvote && (
                    <button
                      type="button"
                      className="hn-c-upvote"
                      aria-busy={upvote.isPending}
                      aria-disabled={upvote.isPending || upvote.isSuccess}
                      data-voted={upvote.isSuccess || undefined}
                      onClick={() => {
                        if (!upvote.isPending && !upvote.isSuccess) upvote.mutate()
                      }}
                    >
                      {upvote.isPending ? "upvoting…" : upvote.isSuccess ? "upvoted" : "upvote"}
                    </button>
                  )}
                </div>
                {upvote.isError && (
                  <p className="hn-c-vote-error" role="alert">
                    {upvote.error instanceof Error ? upvote.error.message : "Couldn't upvote. Try again."}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="t-acc-panel">
        <div className="t-acc-panel-inner" inert={collapsed}>
          {(comment.children.length > 0 || isReplying) && (
            <div className="hn-c-replies">
              {/* The thread line doubles as a collapse target, like on Reddit. */}
              <button
                type="button"
                className="hn-c-guide"
                onClick={toggle}
                aria-label={`Collapse thread by ${comment.author}`}
              />
              {isReplying && (
                <div className="hn-inline-composer">
                  {commentingEnabled ? (
                    <Composer
                      value={draft}
                      onChange={onDraftChange}
                      placeholder={`Reply to ${comment.author}…`}
                      submitLabel="Reply"
                      ariaLabel={`Reply to ${comment.author}`}
                      isPending={isPending}
                      error={composerError}
                      confirming={confirming}
                      onCancel={onCancel}
                      onKeep={onKeep}
                      onDiscard={onDiscard}
                      onSubmit={onSubmit}
                    />
                  ) : (
                    <InlineLoginPrompt onClose={onCancel} />
                  )}
                </div>
              )}
              {comment.children.length > 0 && (
                <ul>
                  {comment.children.map((c) => (
                    <Comment key={c.id} comment={c} op={op} now={now} {...callbacks} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

function Composer({
  value,
  onChange,
  placeholder,
  submitLabel,
  ariaLabel,
  isPending,
  error,
  confirming,
  onCancel,
  onKeep,
  onDiscard,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  submitLabel: string
  ariaLabel: string
  isPending: boolean
  error: string | null
  confirming: boolean
  onCancel: () => void
  onKeep: () => void
  onDiscard: () => void
  onSubmit: () => void
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const fitHeight = (el: HTMLTextAreaElement) => {
    if (typeof CSS !== "undefined" && CSS.supports("field-sizing", "content")) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    boxRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [])

  // Bring the composer into view if the user triggers discard confirmation while scrolled away.
  useEffect(() => {
    if (confirming) boxRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [confirming])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      if (isPending) return
      if (confirming) {
        onKeep()
        inputRef.current?.focus({ preventScroll: true })
      } else {
        onCancel()
      }
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSubmit()
    }
  }

  const canSubmit = Boolean(value.trim()) && !isPending
  const primaryLabel = error ? "Retry" : submitLabel

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: catches Escape and Cmd+Enter across the textarea and footer buttons.
    <div className="hn-composer" ref={boxRef} data-error={error ? "true" : undefined} onKeyDown={onKeyDown}>
      <textarea
        ref={inputRef}
        className="hn-composer-input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          fitHeight(e.currentTarget)
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={2}
        disabled={isPending}
      />
      <footer className="hn-composer-foot">
        {isPending ? (
          <>
            <span className="hn-composer-status" aria-live="polite">
              Posting…
            </span>
            <div className="hn-composer-btns">
              <button type="button" className="hn-composer-cancel" disabled>
                Cancel
              </button>
              <button type="button" className="hn-composer-submit" disabled>
                {submitLabel}
              </button>
            </div>
          </>
        ) : confirming ? (
          <>
            <span className="hn-composer-confirm-msg">Discard draft?</span>
            <div className="hn-composer-btns">
              <button
                type="button"
                className="hn-composer-cancel"
                onClick={() => {
                  onKeep()
                  inputRef.current?.focus({ preventScroll: true })
                }}
              >
                Keep
              </button>
              <button type="button" className="hn-composer-discard" onClick={onDiscard}>
                Discard
              </button>
            </div>
          </>
        ) : error ? (
          <>
            <span className="hn-composer-error" role="alert">
              {error}
            </span>
            <div className="hn-composer-btns">
              <button type="button" className="hn-composer-cancel" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="hn-composer-submit" disabled={!canSubmit} onClick={onSubmit}>
                {primaryLabel}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="hn-composer-hint">
              <kbd>⌘</kbd>
              <kbd>↵</kbd> to post · <kbd>esc</kbd> to cancel
            </span>
            <div className="hn-composer-btns">
              <button type="button" className="hn-composer-cancel" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="hn-composer-submit" disabled={!canSubmit} onClick={onSubmit}>
                {primaryLabel}
              </button>
            </div>
          </>
        )}
      </footer>
    </div>
  )
}

function InlineLoginPrompt({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div className="hn-login-inline">
      <a
        ref={ref}
        className="hn-composer-login"
        href={HN_LOGIN_URL}
        target="_blank"
        rel="noreferrer"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          }
        }}
      >
        Log in to HN to comment
      </a>
    </div>
  )
}

function Html({ html, className }: { html: string; className: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized on the server, see src/server/sanitize.ts.
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
