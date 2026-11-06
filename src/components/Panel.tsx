import type { ReactNode, Ref } from "react"

interface PanelProps {
  id: string
  icon: ReactNode
  title: string
  /** Inline next to the title, e.g. status pills. */
  titleSuffix?: ReactNode
  meta?: ReactNode
  children: ReactNode
  bodyRef?: Ref<HTMLDivElement>
}

export function Panel({ id, icon, title, titleSuffix, meta, children, bodyRef }: PanelProps) {
  return (
    <section className="panel" id={id} aria-labelledby={`${id}-title`}>
      <header className="panel-head">
        <span className="panel-icon">{icon}</span>
        <h2 id={`${id}-title`}>{title}</h2>
        {titleSuffix}
        {meta != null && <span className="panel-meta">{meta}</span>}
      </header>
      <div className="panel-body" ref={bodyRef}>
        {children}
      </div>
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
  return <p className="panel-empty">Loading…</p>
}
