import type { ColumnId } from "../lib/settings"
import type { Features } from "../lib/types"
import { COLUMNS } from "./columns"
import { Dialog } from "./ui/Dialog"

type Group = { title: string; keys: Array<[Array<string>, string]> }

// Lists only the shortcuts that exist, so a hidden column, chat box or capture doesn't show up here.
function groups(features: Features, columns: Array<ColumnId>): Array<Group> {
  const names = columns.map((id) => COLUMNS[id].short).join(", ")
  return [
    {
      title: "Move around",
      keys: [
        [columns.map((_, i) => String(i + 1)), names.charAt(0).toUpperCase() + names.slice(1)],
        [["h", "l"], "Previous / next column"],
        [["j", "k"], "Next / previous row"],
        [["g", "G"], "First / last row"],
        [["esc"], "Leave the column, or close details"],
      ],
    },
    {
      title: "Act",
      keys: [
        [["↵"], "Open the row"],
        [["o"], "Open comments or PR details"],
        [["f"], "Filter the section"],
        [["r"], "Refresh the column (or Hacker News)"],
      ],
    },
    {
      title: "Anywhere",
      keys: [
        ...(features.capture ? [[["c"], "Quick capture to this week's note"] as [Array<string>, string]] : []),
        ...(features.chat ? [[["/"], "Ask the local model"] as [Array<string>, string]] : []),
        [["⌘", "K"], "Search or go to a URL"],
        [[","], "Settings"],
        [["?"], "This sheet"],
      ],
    },
  ]
}

export function Shortcuts({
  open,
  onOpenChange,
  features,
  columns,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  features: Features
  /** Visible columns, in order. */
  columns: Array<ColumnId>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts" aside={<kbd>esc</kbd>}>
      <div className="shortcuts">
        {groups(features, columns).map((g) => (
          <section key={g.title}>
            <h3>{g.title}</h3>
            <dl>
              {g.keys.map(([keys, label]) => (
                <div key={label}>
                  <dt>
                    {keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
