import { useQueryClient } from "@tanstack/react-query"
import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from "react"
import { age, plural } from "../lib/format"
import type { Story } from "../lib/types"
import { useNow } from "../lib/useNow"
import { HNThread, threadQuery } from "./HNThread"
import { HackerNewsIcon } from "./icons"
import { Panel, PanelFallback } from "./Panel"

interface Props {
  stories: Array<Story> | undefined
  error: unknown
}

export function HackerNewsPanel({ stories, error }: Props) {
  const now = useNow()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<Story | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const listScroll = useRef(0)

  const openThread = (story: Story) => (e: MouseEvent) => {
    // Let cmd/ctrl/shift/middle-click open the real HN page in a new tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    listScroll.current = bodyRef.current?.scrollTop ?? 0
    setOpen(story)
  }
  // Algolia takes 1–3 s for big threads, so start loading on hover.
  const prefetch = (story: Story) => () => void queryClient.prefetchQuery(threadQuery(story.id))

  // Thread opens at the top. Back restores the list where you left it.
  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = open ? 0 : listScroll.current
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
      meta={open ? "Comments" : stories ? `Top ${stories.length}` : undefined}
      bodyRef={bodyRef}
    >
      {open ? (
        <HNThread story={open} onBack={() => setOpen(null)} />
      ) : !stories ? (
        <PanelFallback error={error} />
      ) : (
        <ol className="hn-list">
          {stories.map((s, i) => (
            <li key={s.id} className="hn-item">
              <span className="hn-rank mono">{i + 1}</span>
              <div className="hn-main">
                <a className="hn-title" href={s.url}>
                  {s.title}
                </a>
                <p className="hn-meta">
                  <span>{s.domain}</span>
                  <span>{plural(s.points, "pt")}</span>
                  <a href={s.discussion} onClick={openThread(s)} onMouseEnter={prefetch(s)} onFocus={prefetch(s)}>
                    {plural(s.comments, "comment")}
                  </a>
                  <span>{age(s.time, now)}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
