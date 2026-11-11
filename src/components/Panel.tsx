import type { ReactNode } from "react"

interface PanelProps {
  id: string
  icon: ReactNode
  title: string
  meta?: ReactNode
  /** The panel "r" refreshes when no panel has focus. */
  refreshDefault?: boolean
  children: ReactNode
}

export function Panel({ id, icon, title, meta, refreshDefault, children }: PanelProps) {
  return (
    <section
      className="panel"
      id={id}
      aria-labelledby={`${id}-title`}
      data-nav-panel
      // Focusable from script only, for columns with no rows (see useKeyboardNav).
      tabIndex={-1}
      data-refresh-default={refreshDefault || undefined}
    >
      <header className="panel-head">
        <span className="panel-icon">{icon}</span>
        <h2 id={`${id}-title`}>{title}</h2>
        {meta != null && <span className="panel-meta">{meta}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}

/** Shown before a panel has data: the error if the fetch failed, else a loading line. */
export function PanelFallback({ error }: { error: unknown }) {
  return error ? <PanelError error={error} /> : <PanelLoading />
}

export function PanelError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return <p className="panel-error">{message}</p>
}

export function PanelLoading() {
  return (
    <p className="panel-empty">
      <span className="t-shimmer" data-text="Loading…">
        Loading…
      </span>
    </p>
  )
}
