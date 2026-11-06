import { Dialog } from "./ui/Dialog"

const GROUPS: Array<{ title: string; keys: Array<[Array<string>, string]> }> = [
  {
    title: "Move around",
    keys: [
      [["1", "2", "3", "4"], "Today, issues, PRs, Hacker News"],
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
      [["r"], "Refresh Hacker News"],
    ],
  },
  {
    title: "Anywhere",
    keys: [
      [["c"], "Quick capture to this week's note"],
      [["/"], "Ask the local model"],
      [["⌘", "K"], "Search or go to a URL"],
      [["?"], "This sheet"],
    ],
  },
]

export function Shortcuts({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts" aside={<kbd>esc</kbd>}>
      <div className="shortcuts">
        {GROUPS.map((g) => (
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
