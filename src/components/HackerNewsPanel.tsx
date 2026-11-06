import { useQueryClient } from "@tanstack/react-query"
import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from "react"
import { age, clock, plural } from "../lib/format"
import type { Story } from "../lib/types"
import { useNow } from "../lib/useNow"
import { refreshHN } from "../server/fns"
import { HNThread, threadQuery } from "./HNThread"
import { HackerNewsIcon } from "./icons"
import { Panel, PanelFallback } from "./Panel"
import { SwapText } from "./ui/motion"
import { RefreshButton } from "./ui/RefreshButton"

interface Props {
  stories: Array<Story> | undefined
  fetchedAt: number | undefined
  error: unknown
}

export function HackerNewsPanel({ stories, fetchedAt, error }: Props) {
  const now = useNow()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<Story | null>(null)
  // The last opened story stays rendered while the thread page slides out.
  const [shown, setShown] = useState<Story | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  // The story row that opened the thread, so closing it puts focus back there.
  const returnTo = useRef<HTMLElement | null>(null)

  const openThread = (story: Story) => (e: MouseEvent) => {
    // Let cmd/ctrl/shift/middle-click open the real HN page in a new tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    returnTo.current =
      (e.currentTarget as HTMLElement).closest("[data-nav-item]")?.querySelector("[data-nav-row]") ?? null
    setOpen(story)
    setShown(story)
  }
  // Algolia takes 1–3 s for big threads, so start loading on hover.
  const prefetch = (story: Story) => () => void queryClient.prefetchQuery(threadQuery(story.id))

  // Each page scrolls on its own, so the list keeps its place. A new thread opens at the top.
  // The page you leave turns inert and drops focus, so move it along: into the thread
  // on open, back to the story on close.
  useLayoutEffect(() => {
    if (open) {
      if (threadRef.current) threadRef.current.scrollTop = 0
      threadRef.current?.querySelector<HTMLElement>(".hn-back")?.focus({ preventScroll: true })
    } else {
      returnTo.current?.focus({ preventScroll: true })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) setOpen(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <Panel
      id="hn"
      icon={<HackerNewsIcon />}
      title="Hacker News"
      meta={
        open ? (
          "Comments"
        ) : (
          <span className="panel-sync">
            {fetchedAt != null && (
              <time dateTime={new Date(fetchedAt).toISOString()}>
                <SwapText text={clock(fetchedAt)} />
              </time>
            )}
            <RefreshButton queryKey={["hn"]} refresh={refreshHN} what="stories" />
          </span>
        )
      }
    >
      <div className="t-page-slide" data-page={open ? "2" : "1"}>
        <section className="t-page" data-page-id="1" inert={open != null}>
          {stories ? (
            <StoryList stories={stories} now={now} onOpen={openThread} onPrefetch={prefetch} />
          ) : (
            <PanelFallback error={error} />
          )}
        </section>
        <section className="t-page" data-page-id="2" ref={threadRef} inert={open == null}>
          {shown && <HNThread story={shown} onBack={() => setOpen(null)} />}
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
}: {
  stories: Array<Story>
  now: number
  onOpen: (story: Story) => (e: MouseEvent) => void
  onPrefetch: (story: Story) => () => void
}) {
  return (
    <ol className="hn-list">
      {stories.map((s, i) => (
        <li key={s.id} className="hn-item" data-nav-item>
          <span className="hn-rank mono">{i + 1}</span>
          <div className="hn-main">
            <a className="hn-title" href={s.url} target="_blank" rel="noreferrer" data-nav-row>
              {s.title}
            </a>
            <p className="hn-meta">
              <span>{s.domain}</span>
              <span>{plural(s.points, "pt")}</span>
              <a
                href={s.discussion}
                onClick={onOpen(s)}
                onMouseEnter={onPrefetch(s)}
                onFocus={onPrefetch(s)}
                data-nav-alt
              >
                {plural(s.comments, "comment")}
              </a>
              <span>{age(s.time, now)}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
