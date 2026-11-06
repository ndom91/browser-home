import { type ReactNode, useEffect, useMemo, useState } from "react"
import { activeFilterCount, type FilterFacet, type FilterState } from "../components/ui/FilterMenu"

/** One filterable dimension of an item, e.g. its repo or project. */
export interface Facet<T> {
  key: string
  label: string
  get: (item: T) => string | null
  /** Display text for a value. `all` is every value in the list, for disambiguation. */
  optionLabel?: (value: string, all: Array<string>) => string
  /** Swatch or icon before the option label. */
  leading?: (value: string) => ReactNode
  /** Keep the facet in the menu even with a single option. Others hide below two. */
  always?: boolean
}

/**
 * Filter state for a list, saved per `storageKey`. Options come only from the items
 * in the list, and saved values no longer in it are ignored, so a closed PR or a
 * finished issue can't leave a list empty for no visible reason.
 */
export function useFacetFilter<T>(storageKey: string, items: Array<T>, facets: Array<Facet<T>>) {
  const [saved, setSaved] = useStoredFilters(storageKey)

  const menu = useMemo<Array<FilterFacet>>(
    () =>
      facets
        .map((f) => {
          const values = [...new Set(items.map(f.get).filter((v) => v != null))].sort()
          return {
            key: f.key,
            label: f.label,
            options: values.map((value) => ({
              value,
              label: f.optionLabel ? f.optionLabel(value, values) : value,
              leading: f.leading?.(value),
            })),
            always: f.always,
          }
        })
        .filter((f) => f.options.length > 1 || f.always)
        .map(({ always: _, ...f }) => f),
    [items, facets],
  )

  const value = useMemo(() => {
    const out: FilterState = {}
    for (const f of menu) {
      const kept = (saved[f.key] ?? []).filter((v) => f.options.some((o) => o.value === v))
      if (kept.length) out[f.key] = kept
    }
    return out
  }, [saved, menu])

  const filtering = activeFilterCount(value) > 0
  const visible = filtering
    ? items.filter((item) =>
        facets.every((f) => {
          const wanted = value[f.key]
          if (!wanted?.length) return true
          const v = f.get(item)
          return v != null && wanted.includes(v)
        }),
      )
    : items

  return { facets: menu, value, onChange: setSaved, visible, filtering }
}

/** Read after mount, so server and client render the same first frame. */
function useStoredFilters(key: string) {
  const [value, setValue] = useState<FilterState>({})
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setValue(JSON.parse(raw))
    } catch {}
  }, [key])
  const set = (next: FilterState) => {
    setValue(next)
    localStorage.setItem(key, JSON.stringify(next))
  }
  return [value, set] as const
}
