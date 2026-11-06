import { useEffect, useLayoutEffect, useRef, useState } from "react"

/** Reads a duration token like "150ms" from :root, so JS timing follows the CSS. */
function cssMs(name: string, fallback: number) {
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
