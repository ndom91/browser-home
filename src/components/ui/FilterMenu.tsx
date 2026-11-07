import { Menu } from "@base-ui/react/menu"
import type { ReactNode } from "react"
import { CheckIcon, ChevronRightIcon, FilterIcon } from "../icons"

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

/** Overflow menu with one submenu of checkboxes per facet. */
export function FilterMenu({ label, facets, value, onChange }: Props) {
  const active = activeFilterCount(value)

  const toggle = (facet: string, option: string, on: boolean) => {
    const current = value[facet] ?? []
    const next = on ? [...current, option] : current.filter((v) => v !== option)
    onChange({ ...value, [facet]: next })
  }

  return (
    <Menu.Root>
      <Menu.Trigger className={`menu-trigger${active ? " is-active" : ""}`} aria-label={label}>
        {active > 0 && <span className="menu-trigger-count">{active}</span>}
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
  )
}
