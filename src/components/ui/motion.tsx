import { Children, type ComponentProps, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"

/** Reads a duration token like "150ms" from :root, so JS timing follows the CSS. */
export function cssMs(name: string, fallback: number) {
  const v = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

/** The last two characters trail the rest, like the transitions.dev number pop-in. */
function staggerOf(i: number, length: number) {
  if (i === length - 1) return "2"
  if (i === length - 2) return "1"
  return undefined
}

/**
 * Text whose characters pop in when the value changes. The first render is
 * static, so a page load doesn't animate every number on screen.
 */
export function PopIn({ value }: { value: string }) {
  const last = useRef(value)
  const changed = useRef(false)
  if (last.current !== value) {
    last.current = value
    changed.current = true
  }
  const chars = [...value]
  return (
    // Keyed by value: each change remounts the digits, which replays the animation.
    <span key={value} className={`t-digit-group${changed.current ? " is-animating" : ""}`}>
      {chars.map((ch, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: characters repeat, and the group remounts on change anyway.
        <span key={i} className="t-digit" data-stagger={staggerOf(i, chars.length)}>
          {ch}
        </span>
      ))}
    </span>
  )
}

const PHASE_CLASS = { idle: "", exit: " is-exit", enter: " is-enter-start" } as const

/** Text that swaps in place: the old copy exits up, the new one rises in. */
export function SwapText({ text }: { text: string }) {
  const [shown, setShown] = useState(text)
  const [phase, setPhase] = useState<"idle" | "exit" | "enter">("idle")
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (text === shown) return
    setPhase("exit")
    const timer = setTimeout(
      () => {
        setShown(text)
        setPhase("enter")
      },
      cssMs("--text-swap-dur", 150),
    )
    return () => clearTimeout(timer)
  }, [text, shown])

  // Commit the "below, no transition" pose, flush it, then release so the new text transitions in.
  useLayoutEffect(() => {
    if (phase !== "enter") return
    void ref.current?.offsetHeight
    setPhase("idle")
  }, [phase])

  return (
    <span ref={ref} className={`t-text-swap${PHASE_CLASS[phase]}`}>
      {shown}
    </span>
  )
}

const THINKING = ["Thinking…", "Still thinking…"]

/**
 * Shimmering status line (transitions.dev thinking-states). It shows only
 * what is true: "Thinking…", then "Still thinking…" once --think-hold passes.
 */
export function ThinkingLine() {
  const [step, setStep] = useState(0)
  const [entering, setEntering] = useState(false)
  const nextRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const timer = setTimeout(
      () => {
        setStep(1)
        setEntering(true)
      },
      cssMs("--think-hold", 4000),
    )
    return () => clearTimeout(timer)
  }, [])

  // Same release as SwapText: commit the "below" pose, flush, then let it transition in.
  useLayoutEffect(() => {
    if (!entering) return
    void nextRef.current?.offsetWidth
    setEntering(false)
  }, [entering])

  return (
    <span className="t-think">
      <span className="t-think-sizer" aria-hidden="true">
        {THINKING.at(-1)}
      </span>
      {THINKING.slice(0, step + 1).map((text, i) => {
        const leaving = i < step
        return (
          <span
            key={text}
            ref={leaving ? undefined : nextRef}
            className={`t-think-text${leaving ? " is-exit" : ""}${!leaving && entering ? " is-enter-start" : ""}`}
            data-text={text}
            aria-hidden={leaving}
          >
            {text}
          </span>
        )
      })}
    </span>
  )
}

/** Wraps each word of a block's text in a span that fades in when it mounts (streaming-text). */
function streamWords(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== "string") return child
    return child.split(/(\s+)/).map((part, i) => {
      if (/^\s*$/.test(part)) return part
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: word position is the identity; a growing last word must not remount.
        <span key={i} className="t-stream-w">
          {part}
        </span>
      )
    })
  })
}

/** Markdown components for a reply that is still streaming. Finished replies render plain. */
export const STREAMING_COMPONENTS = {
  p: ({ children, ...props }: ComponentProps<"p">) => <p {...props}>{streamWords(children)}</p>,
  li: ({ children, ...props }: ComponentProps<"li">) => <li {...props}>{streamWords(children)}</li>,
}

type RowPhase = "enter" | "idle" | "exit"

/**
 * A list whose rows collapse out and grow in (transitions.dev accordion, per row), so
 * filtering never makes rows pop. The rows around them glide along as the height
 * animates. The first render is static; later changes animate.
 */
export function AnimatedList<T>({
  items,
  getKey,
  className,
  render,
}: {
  items: Array<T>
  getKey: (item: T) => string
  className: string
  render: (item: T) => ReactNode
}) {
  const keys = items.map(getKey)
  const signature = keys.join("\n")
  const [rows, setRows] = useState<Array<{ key: string; phase: RowPhase }>>(() =>
    keys.map((key) => ({ key, phase: "idle" })),
  )
  // Latest data per key, so exiting rows keep rendering after they leave `items`.
  const latest = useRef(new Map<string, T>())
  for (const item of items) latest.current.set(getKey(item), item)
  const listRef = useRef<HTMLUListElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the key list; `keys` is a new array every render.
  useLayoutEffect(() => {
    setRows((prev) => {
      const present = new Set(keys)
      const before = new Map(prev.map((r) => [r.key, r.phase]))
      const next: Array<{ key: string; phase: RowPhase }> = keys.map((key) => {
        const phase = before.get(key)
        return { key, phase: phase === undefined || phase === "exit" ? "enter" : phase }
      })
      // Leaving rows stay where they were: right after the nearest earlier row that's still here.
      prev.forEach((row, i) => {
        if (present.has(row.key)) return
        const anchor = prev
          .slice(0, i)
          .reverse()
          .find((r) => next.some((n) => n.key === r.key))
        next.splice(anchor ? next.findIndex((n) => n.key === anchor.key) + 1 : 0, 0, { key: row.key, phase: "exit" })
      })
      return next
    })
  }, [signature])

  // Entering rows render collapsed first; flush that pose, then release them to expand.
  useLayoutEffect(() => {
    if (!rows.some((r) => r.phase === "enter")) return
    void listRef.current?.offsetHeight
    setRows((prev) => prev.map((r) => (r.phase === "enter" ? { ...r, phase: "idle" } : r)))
  }, [rows])

  // Drop exiting rows once their collapse has played.
  useEffect(() => {
    if (!rows.some((r) => r.phase === "exit")) return
    const timer = setTimeout(
      () => setRows((prev) => prev.filter((r) => r.phase !== "exit")),
      cssMs("--acc-collapse", 250),
    )
    return () => clearTimeout(timer)
  }, [rows])

  return (
    <ul ref={listRef} className={className}>
      {rows.map(({ key, phase }) => {
        const item = latest.current.get(key)
        if (item === undefined) return null
        return (
          <li key={key} className="t-list-row" data-state={phase} inert={phase === "exit"}>
            <div className="t-list-inner">{render(item)}</div>
          </li>
        )
      })}
    </ul>
  )
}
