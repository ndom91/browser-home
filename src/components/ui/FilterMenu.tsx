import { Menu } from "@base-ui/react/menu"
import type { ReactNode } from "react"
import { CheckIcon, ChevronRightIcon, CloseIcon, FilterIcon } from "../icons"

export interface FilterOption {
  value: string
  label: string
  /** Optional swatch or icon shown before the label. */
  leading?: ReactNode
}

export interface FilterFacet {
  key: string
  label: string
  options: Array<FilterOption>
}

/** Selected values per facet key. A missing or empty list means "no filter". */
export type FilterState = Record<string, Array<string>>

interface Props {
  label: string
  facets: Array<FilterFacet>
  value: FilterState
  onChange: (next: FilterState) => void
}

export function activeFilterCount(value: FilterState) {
  return Object.values(value).reduce((n, v) => n + v.length, 0)
}

/** Pills shown before the trigger; the rest fold into "+N". */
const MAX_PILLS = 2

/** Overflow menu with one submenu of checkboxes per facet, plus pills for the active filters. */
export function FilterMenu({ label, facets, value, onChange }: Props) {
  const active = activeFilterCount(value)

  const toggle = (facet: string, option: string, on: boolean) => {
    const current = value[facet] ?? []
    const next = on ? [...current, option] : current.filter((v) => v !== option)
    onChange({ ...value, [facet]: next })
  }

  // Every selected value, in menu order, with the label and swatch the menu uses.
  const pills = facets.flatMap((facet) =>
    facet.options
      .filter((o) => value[facet.key]?.includes(o.value))
      .map((o) => ({ facet: facet.key, facetLabel: facet.label, ...o })),
  )
  const hidden = pills.slice(MAX_PILLS)

  return (
    <>
      {pills.length > 0 && (
        <ul className="filter-pills" aria-label="Active filters">
          {pills.slice(0, MAX_PILLS).map((p) => (
            <li key={`${p.facet}:${p.value}`} className="filter-pill" title={`${p.facetLabel}: ${p.label}`}>
              {p.leading}
              <span className="filter-pill-label">{p.label}</span>
              <button
                type="button"
                className="filter-pill-remove"
                onClick={() => toggle(p.facet, p.value, false)}
                aria-label={`Remove filter ${p.facetLabel}: ${p.label}`}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
          {hidden.length > 0 && (
            <li className="filter-pill is-more" title={hidden.map((p) => `${p.facetLabel}: ${p.label}`).join("\n")}>
              +{hidden.length}
            </li>
          )}
        </ul>
      )}
      <Menu.Root>
        <Menu.Trigger className={`menu-trigger${active ? " is-active" : ""}`} aria-label={label}>
          <FilterIcon />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className="menu-positioner" side="bottom" align="end" sideOffset={4}>
            <Menu.Popup className="menu-popup">
              <Menu.Group>
                <Menu.GroupLabel className="menu-label">Filter by</Menu.GroupLabel>
                {facets.map((facet) => {
                  const selected = value[facet.key] ?? []
                  return (
                    <Menu.SubmenuRoot key={facet.key}>
                      <Menu.SubmenuTrigger className="menu-item" disabled={facet.options.length === 0}>
                        <span className="menu-item-label">{facet.label}</span>
                        {selected.length > 0 && <span className="menu-item-hint">{selected.length}</span>}
                        <ChevronRightIcon className="menu-item-chevron" />
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner className="menu-positioner" alignOffset={-4} sideOffset={2}>
                          <Menu.Popup className="menu-popup">
                            {facet.options.map((o) => (
                              <Menu.CheckboxItem
                                key={o.value}
                                className="menu-item"
                                checked={selected.includes(o.value)}
                                onCheckedChange={(on) => toggle(facet.key, o.value, on)}
                                closeOnClick={false}
                              >
                                {/* Kept mounted so the tick can draw in and out (transitions.dev checkbox-check). */}
                                <Menu.CheckboxItemIndicator className="menu-check t-check" keepMounted>
                                  <CheckIcon />
                                </Menu.CheckboxItemIndicator>
                                {o.leading}
                                <span className="menu-item-label">{o.label}</span>
                              </Menu.CheckboxItem>
                            ))}
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  )
                })}
              </Menu.Group>
              {active > 0 && (
                <>
                  <Menu.Separator className="menu-separator" />
                  <Menu.Item className="menu-item" onClick={() => onChange({})}>
                    <span className="menu-item-label">Clear filters</span>
                  </Menu.Item>
                </>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  )
}
