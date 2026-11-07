import type { ReactNode } from "react"
import { type Facet, useFacetFilter } from "../lib/useFacetFilter"
import { FilterMenu } from "./ui/FilterMenu"
import { AnimatedList, PopIn } from "./ui/motion"

interface Props<T> {
  /** Saves this section's filters under its own key. */
  storageKey: string
  title: string
  items: Array<T>
  /** Count in the header when unfiltered. Can exceed `items` when a source caps its list. */
  total?: number
  facets: Array<Facet<T>>
  tone?: "attention"
  getKey: (item: T) => string
  render: (item: T) => ReactNode
}

/** A titled list with a count, a filter menu, and rows that animate as filters change. */
export function FilteredSection<T>({
  storageKey,
  title,
  items,
  total = items.length,
  facets,
  tone,
  getKey,
  render,
}: Props<T>) {
  const filter = useFacetFilter(storageKey, items, facets)
  const { visible, filtering } = filter

  return (
    <div className="list-section" data-nav-section>
      <h3 className="list-section-head">
        {title}
        <span className={`count${tone ? ` count-${tone}` : ""}`}>
          <PopIn value={filtering ? `${visible.length}/${total}` : String(total)} />
        </span>
        <span className="list-section-actions">
          <FilterMenu
            label={`Filter ${title}`}
            facets={filter.facets}
            value={filter.value}
            onChange={filter.onChange}
          />
        </span>
      </h3>
      {/* Always mounted, so the last rows can animate out before the empty message takes over. */}
      <AnimatedList className="list-section-rows" items={visible} getKey={getKey} render={render} />
      {visible.length === 0 && (
        <p className="panel-empty">{filtering ? "Nothing matches these filters." : "Nothing here."}</p>
      )}
    </div>
  )
}
