import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { age, plural, synced } from "../lib/format"
import { itemUrl, readableUrl } from "../lib/hn"
import type { Story } from "../lib/types"
import { useNow } from "../lib/useNow"
import type { Cached } from "../server/cache"
import { refreshHN, upvoteHN } from "../server/fns"
import { HNThread, threadQuery } from "./HNThread"
import { ArrowUpRightIcon, CloseIcon, HackerNewsIcon, RefreshIcon, UpvoteIcon } from "./icons"
import { Panel, PanelFallback } from "./Panel"
import { PopIn, SwapText } from "./ui/motion"
import { RefreshButton } from "./ui/RefreshButton"
import { Tooltip } from "./ui/Tooltip"

const RETURN_FLASH_MS = 1600

interface Props {
  stories: Array<Story> | undefined
  fetchedAt: number | undefined
  error: unknown
  votingEnabled: boolean
  commentingEnabled: boolean
  hnUser: string | null
}

export function HackerNewsPanel({ stories, fetchedAt, error, votingEnabled, commentingEnabled, hnUser }: Props) {
  const now = useNow()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<Story | null>(null)
  // The last opened story stays rendered while the thread page slides out.
  const [shown, setShown] = useState<Story | null>(null)
  const [readIds, setReadIds] = useState<Set<number>>(() => new Set())
  const [returnedId, setReturnedId] = useState<number | null>(null)
  const listRef = useRef<HTMLElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const listScrollTop = useRef(0)
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The story row that opened the thread, so closing it puts focus back there.
  const returnTo = useRef<HTMLElement | null>(null)

  useEffect(
    () => () => {
      if (returnTimer.current) clearTimeout(returnTimer.current)
    },
    [],
  )

  const closeThread = useCallback(() => {
    setOpen((current) => {
      if (!current) return null
      if (returnTimer.current) clearTimeout(returnTimer.current)
      setReturnedId(current.id)
      returnTimer.current = setTimeout(() => setReturnedId(null), RETURN_FLASH_MS)
      return null
    })
  }, [])

  const openThread = (story: Story) => (e: MouseEvent) => {
    // Let cmd/ctrl/shift/middle-click open the real HN page in a new tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    listScrollTop.current = listRef.current?.scrollTop ?? 0
    returnTo.current =
      (e.currentTarget as HTMLElement).closest("[data-nav-item]")?.querySelector("[data-nav-row]") ?? null
    if (returnTimer.current) clearTimeout(returnTimer.current)
    setReturnedId(null)
    setReadIds((prev) => (prev.has(story.id) ? prev : new Set(prev).add(story.id)))
    setOpen(story)
    setShown(story)
  }
  // Algolia takes 1–3 s for big threads, so start loading on hover.
  const prefetch = (story: Story) => () => void queryClient.prefetchQuery(threadQuery(story.id))

  // Each page scrolls on its own, so the list keeps its place. A new thread opens at the top.
  // The page you leave turns inert and drops focus, so move it along: into the thread scroll
  // container on open, back to the story (and its scroll offset) on close.
  useLayoutEffect(() => {
    if (open) {
      const scroll = threadRef.current?.querySelector<HTMLElement>(".hn-thread-scroll")
      if (scroll) {
        scroll.scrollTop = 0
        scroll.focus({ preventScroll: true })
      } else if (threadRef.current) {
        threadRef.current.scrollTop = 0
      }
    } else {
      if (listRef.current) listRef.current.scrollTop = listScrollTop.current
      returnTo.current?.focus({ preventScroll: true })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (
        (e.target as HTMLElement | null)?.closest(
          "input, textarea, [contenteditable], [role=dialog], [role=menu], .hn-composer, .hn-login-inline",
        )
      )
        return
      e.preventDefault()
      closeThread()
    }
    // Capture phase so Esc closes the comments view before useKeyboardNav blurs the panel.
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, closeThread])

  return (
    <Panel
      id="hn"
      refreshDefault
      icon={<HackerNewsIcon />}
      title="Hacker News"
      meta={
        open ? (
          <span className="hn-head-actions">
            <a className="hn-head-open" href={itemUrl(open.id)} target="_blank" rel="noreferrer">
              Open on HN <ArrowUpRightIcon />
            </a>
            <span className="hn-head-sep" aria-hidden="true" />
            <Tooltip
              align="end"
              className="hn-close-tooltip"
              content={
                <span className="hn-close-tip">
                  Close comments <kbd>Esc</kbd>
                </span>
              }
            >
              <button type="button" className="hn-head-close" aria-label="Close comments" onClick={closeThread}>
                <CloseIcon width={14} height={14} />
              </button>
            </Tooltip>
          </span>
        ) : (
          <span className="panel-sync">
            <time dateTime={fetchedAt == null ? undefined : new Date(fetchedAt).toISOString()}>
              <SwapText text={synced(fetchedAt, now)} />
            </time>
            <RefreshButton queryKey={["hn"]} refresh={refreshHN} what="stories" />
          </span>
        )
      }
    >
      <div className="t-page-slide" data-page={open ? "2" : "1"}>
        <section className="t-page" data-page-id="1" ref={listRef} inert={open != null}>
          {stories ? (
            <StoryList
              stories={stories}
              now={now}
              onOpen={openThread}
              onPrefetch={prefetch}
              votingEnabled={votingEnabled}
              readIds={readIds}
              returnedId={returnedId}
            />
          ) : (
            <PanelFallback error={error} />
          )}
        </section>
        <section className="t-page" data-page-id="2" ref={threadRef} inert={open == null}>
          {shown && <HNThread key={shown.id} story={shown} commentingEnabled={commentingEnabled} hnUser={hnUser} />}
        </section>
      </div>
    </Panel>
  )
}

function StoryList({
  stories,
  now,
  onOpen,
  onPrefetch,
  votingEnabled,
  readIds,
  returnedId,
}: {
  stories: Array<Story>
  now: number
  onOpen: (story: Story) => (e: MouseEvent) => void
  onPrefetch: (story: Story) => () => void
  votingEnabled: boolean
  readIds: Set<number>
  returnedId: number | null
}) {
  return (
    <ol className="hn-list">
      {stories.map((s, i) => (
        <StoryRow
          key={s.id}
          story={s}
          rank={i + 1}
          now={now}
          onOpen={onOpen}
          onPrefetch={onPrefetch}
          votingEnabled={votingEnabled}
          read={readIds.has(s.id)}
          returned={returnedId === s.id}
        />
      ))}
    </ol>
  )
}

function StoryRow({
  story,
  rank,
  now,
  onOpen,
  onPrefetch,
  votingEnabled,
  read,
  returned,
}: {
  story: Story
  rank: number
  now: number
  onOpen: (story: Story) => (e: MouseEvent) => void
  onPrefetch: (story: Story) => () => void
  votingEnabled: boolean
  read: boolean
  returned: boolean
}) {
  const queryClient = useQueryClient()
  const setPoints = (points: number) => {
    queryClient.setQueryData<Cached<Array<Story>>>(["hn"], (old) =>
      old ? { ...old, data: old.data.map((s) => (s.id === story.id ? { ...s, points } : s)) } : old,
    )
  }
  const vote = useMutation({
    mutationFn: () => upvoteHN({ data: story.id }),
    onMutate: () => {
      const previous = story.points
      setPoints(previous + 1)
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) setPoints(ctx.previous)
    },
    onSuccess: ({ points }) => setPoints(points),
  })
  let hint = "Upvote"
  if (vote.isPending) hint = "Voting…"
  if (vote.isSuccess) hint = "Upvoted"

  return (
    <li className="hn-item" data-nav-item data-read={read || undefined} data-returned={returned || undefined}>
      <div className="hn-rail">
        <span className="hn-rank mono">{rank}</span>
        {votingEnabled && (
          <Tooltip content={hint}>
            <button
              type="button"
              className="hn-upvote"
              aria-label={`${hint}: ${story.title}`}
              aria-disabled={vote.isPending || vote.isSuccess}
              aria-busy={vote.isPending}
              data-voted={vote.isSuccess || undefined}
              onClick={() => {
                if (!vote.isPending && !vote.isSuccess) vote.mutate()
              }}
            >
              <span className="t-icon-swap" data-state={vote.isPending ? "b" : "a"} aria-hidden="true">
                <span className="t-icon" data-icon="a">
                  <UpvoteIcon />
                </span>
                <span className="t-icon" data-icon="b">
                  <RefreshIcon width={10} height={10} className="hn-vote-spinner" />
                </span>
              </span>
            </button>
          </Tooltip>
        )}
      </div>
      <div className="hn-main">
        <a className="hn-title" href={readableUrl(story.url)} target="_blank" rel="noreferrer" data-nav-row>
          {story.title}
        </a>
        <p className="hn-meta">
          <span>{story.domain}</span>
          <span className="hn-points">
            <PopIn value={String(story.points)} /> {story.points === 1 ? "pt" : "pts"}
          </span>
          <a
            href={story.discussion}
            onClick={onOpen(story)}
            onMouseEnter={onPrefetch(story)}
            onFocus={onPrefetch(story)}
            data-nav-alt
          >
            {plural(story.comments, "comment")}
          </a>
          <span>{age(story.time, now)}</span>
        </p>
        {vote.isError && (
          <p className="hn-vote-error" role="alert">
            {vote.error.message}{" "}
            <a href={story.discussion} target="_blank" rel="noreferrer">
              Vote on HN ↗
            </a>
          </p>
        )}
      </div>
    </li>
  )
}
