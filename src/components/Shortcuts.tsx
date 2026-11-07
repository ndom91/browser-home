import type { Features } from "../lib/types"
import { Dialog } from "./ui/Dialog"

type Group = { title: string; keys: Array<[Array<string>, string]> }

// Lists only the shortcuts that exist, so a hidden column or chat box doesn't show up here.
function groups({ chat, linear }: Features): Array<Group> {
  return [
    {
      title: "Move around",
      keys: [
        linear
          ? [["1", "2", "3", "4"], "Today, issues, PRs, Hacker News"]
          : [["1", "2", "3"], "Today, PRs, Hacker News"],
        [["h", "l"], "Previous / next column"],
        [["j", "k"], "Next / previous row"],
        [["g", "G"], "First / last row"],
        [["esc"], "Leave the column, or close a thread"],
      ],
    },
    {
      title: "Act",
      keys: [
        [["↵"], "Open the row"],
        [["o"], "Open HN comments"],
        [["f"], "Filter the section"],
        [["r"], "Refresh the column (or Hacker News)"],
      ],
    },
    {
      title: "Anywhere",
      keys: [
        [["c"], "Quick capture to this week's note"],
        ...(chat ? [[["/"], "Ask the local model"] as [Array<string>, string]] : []),
        [["⌘", "K"], "Search or go to a URL"],
        [["?"], "This sheet"],
      ],
    },
  ]
}

export function Shortcuts({
  open,
  onOpenChange,
  features,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  features: Features
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts" aside={<kbd>esc</kbd>}>
      <div className="shortcuts">
        {groups(features).map((g) => (
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
