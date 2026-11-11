import { type ReactNode, useRef, useState } from "react"
import { motionMs } from "./ui/motion"
import { Tooltip } from "./ui/Tooltip"

/** Something on a row that wants your attention, such as a new comment. */
export interface Signal {
  key: string
  icon: ReactNode
  label: string
  tone: "info" | "warn"
  onDismiss: () => void
}

/** Small icon buttons on a row. Clicking one fades it out, then dismisses it. */
export function RowSignals({ signals }: { signals: Array<Signal> }) {
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  const pending = useRef(new Set<string>())
  if (signals.length === 0) return null

  const dismiss = (signal: Signal) => {
    if (pending.current.has(signal.key)) return
    pending.current.add(signal.key)
    setLeaving((prev) => new Set(prev).add(signal.key))
    setTimeout(
      () => {
        signal.onDismiss()
        pending.current.delete(signal.key)
        // If the dismiss fails and the signal comes back, it must be visible again.
        setLeaving((prev) => new Set([...prev].filter((k) => k !== signal.key)))
      },
      motionMs("--signal-exit", 150),
    )
  }

  return (
    <span className="signals">
      {signals.map((s) => (
        <Tooltip key={s.key} content={`${s.label} · click to dismiss`}>
          <button
            type="button"
            className={`signal signal-${s.tone}`}
            data-leaving={leaving.has(s.key) || undefined}
            aria-label={`${s.label}. Dismiss`}
            onClick={() => dismiss(s)}
          >
            {s.icon}
          </button>
        </Tooltip>
      ))}
    </span>
  )
}
