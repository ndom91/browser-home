import { useEffect } from "react"

/**
 * Page-wide keyboard navigation over [data-nav-panel] columns and their [data-nav-row]
 * rows. It finds everything through data-* attributes, never class names or ids, so
 * restyling can't break a shortcut. Rows are the real focus targets (mostly links), so
 * Enter opens them natively.
 *
 *   1–4        focus a panel          h l / ← →   previous / next panel
 *   j k / ↓ ↑  next / previous row    g / G       first / last row
 *   o          a row's alternate link (HN: comments)
 *   f          the focused section's filter menu
 *   r          refresh this column (else HN)   ?   shortcuts sheet
 *   ,          settings
 *   Esc        leave the panel
 *
 * "/" (chat), "c" (capture) and ⌘K (search) live with their components.
 */
export function useKeyboardNav(onHelp: () => void, onSettings: () => void) {
  useEffect(() => {
    // Last focused row per panel, so jumping back lands where you were.
    const lastRow = new WeakMap<Element, HTMLElement>()
    const onFocus = (e: FocusEvent) => {
      const row = (e.target as HTMLElement).closest?.<HTMLElement>("[data-nav-row]")
      const panel = row?.closest("[data-nav-panel]")
      if (row && panel) lastRow.set(panel, row)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]")) return

      const panels = [...document.querySelectorAll<HTMLElement>("[data-nav-panel]")]
      const active = document.activeElement as HTMLElement | null
      const panel = active?.closest<HTMLElement>("[data-nav-panel]") ?? null
      const rowsOf = (p: Element) =>
        [...p.querySelectorAll<HTMLElement>("[data-nav-row]")].filter((r) => !r.closest("[inert]") && r.offsetParent)
      const focusRow = (row: HTMLElement | undefined) => {
        if (!row) return
        // focusVisible: always draw the ring, since this focus move came from a key.
        row.focus({ preventScroll: true, focusVisible: true } as FocusOptions)
        row.scrollIntoView({ block: "nearest" })
      }
      const enterPanel = (p: Element | undefined) => {
        if (!p) return
        const remembered = lastRow.get(p)
        focusRow(remembered?.isConnected && rowsOf(p).includes(remembered) ? remembered : rowsOf(p)[0])
      }
      const step = (delta: number) => {
        if (!panel) return enterPanel(panels[0])
        const rows = rowsOf(panel)
        const i = rows.indexOf(active?.closest<HTMLElement>("[data-nav-row]") as HTMLElement)
        focusRow(rows[i < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, i + delta))])
      }
      const movePanel = (delta: number) => {
        const i = panel ? panels.indexOf(panel) : -1
        enterPanel(panels[Math.min(panels.length - 1, Math.max(0, i + delta))])
      }

      // Arrows only take over once you're in a panel, so they still scroll the page otherwise.
      if (e.key.startsWith("Arrow") && !panel) return
      // Links and buttons handle Enter themselves.
      if (e.key === "Enter" && active?.matches("a, button")) return

      const digit = Number(e.key)
      if (Number.isInteger(digit) && digit >= 1 && digit <= panels.length) {
        e.preventDefault()
        return enterPanel(panels[digit - 1])
      }

      switch (e.key) {
        case "j":
        case "ArrowDown":
          step(1)
          break
        case "k":
        case "ArrowUp":
          step(-1)
          break
        case "g":
          if (panel) focusRow(rowsOf(panel)[0])
          break
        case "G":
          if (panel) focusRow(rowsOf(panel).at(-1))
          break
        case "h":
        case "ArrowLeft":
          movePanel(-1)
          break
        case "l":
        case "ArrowRight":
          movePanel(1)
          break
        case "o":
          active?.closest("[data-nav-item]")?.querySelector<HTMLElement>("[data-nav-alt]")?.click()
          break
        case "f":
          ;(active?.closest("[data-nav-section]") ?? panel)
            ?.querySelector<HTMLElement>("[data-filter-trigger]")
            ?.click()
          break
        case "r":
          ;(panel ?? document.querySelector("[data-refresh-default]"))
            ?.querySelector<HTMLElement>("[data-refresh]")
            ?.click()
          break
        case "?":
          onHelp()
          break
        case ",":
          onSettings()
          break
        case "Escape":
          if (!panel) return
          active?.blur()
          break
        case "Enter":
          // Rows that aren't links (calendar events) forward Enter to their primary action.
          active?.querySelector<HTMLElement>("[data-nav-primary]")?.click()
          break
        default:
          return
      }
      e.preventDefault()
    }

    document.addEventListener("focusin", onFocus)
    window.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("focusin", onFocus)
      window.removeEventListener("keydown", onKey)
    }
  }, [onHelp, onSettings])
}
