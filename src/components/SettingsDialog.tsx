import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { type CSSProperties, type DragEvent, type KeyboardEvent, useState } from "react"
import { DEFAULT_REVIEW_PROMPT, REVIEW_PROMPT_MAX, useReviewPrompt } from "../lib/reviewPrompt"
import type { ColumnId, Settings, Theme } from "../lib/settings"
import type { Features } from "../lib/types"
import { useSettings } from "../lib/useSettings"
import { COLUMNS } from "./columns"
import { EyeIcon, EyeOffIcon, GripIcon } from "./icons"
import { Dialog } from "./ui/Dialog"

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  features: Features
}

export function SettingsDialog({ open, onOpenChange, features }: Props) {
  const { settings, update } = useSettings()
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Settings" aside={<kbd>esc</kbd>}>
      <div className="settings">
        <section>
          <h3>Theme</h3>
          <ThemePicker value={settings.theme} onChange={(theme) => update({ ...settings, theme })} />
        </section>
        <section>
          <h3>Columns</h3>
          <ColumnList
            columns={settings.columns}
            available={(id) => id !== "linear" || features.linear}
            onChange={(columns) => update({ ...settings, columns })}
          />
        </section>
        <section>
          <h3>Workday</h3>
          <WorkdayFields value={settings.workday} onChange={(workday) => update({ ...settings, workday })} />
        </section>
        <section>
          <h3>
            <label htmlFor="review-prompt">Review prompt</label>
          </h3>
          <ReviewPromptField />
        </section>
      </div>
    </Dialog>
  )
}

/** Segmented control. The highlight slides between options (transitions.dev sliding tabs). */
function ThemePicker({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  const index = THEMES.findIndex((t) => t.value === value)
  return (
    <RadioGroup
      className="segmented"
      aria-label="Theme"
      value={value}
      onValueChange={(v) => onChange(v as Theme)}
      style={{ "--seg-count": THEMES.length, "--seg-index": index } as CSSProperties}
    >
      <span className="segmented-indicator" aria-hidden="true" />
      {THEMES.map((t) => (
        <Radio.Root key={t.value} value={t.value} className="segmented-option">
          {t.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}

type Columns = Settings["columns"]

function move(columns: Columns, from: number, to: number): Columns {
  const next = [...columns]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * Drag rows to reorder, or focus a row and press Alt+↑/↓. The order changes live while
 * dragging and is saved on drop. At least one column stays visible.
 */
function ColumnList({
  columns,
  available,
  onChange,
}: {
  columns: Columns
  available: (id: ColumnId) => boolean
  onChange: (columns: Columns) => void
}) {
  const [draft, setDraft] = useState<Columns | null>(null)
  const [dragging, setDragging] = useState<ColumnId | null>(null)
  const shown = draft ?? columns
  const visibleCount = shown.filter((c) => !c.hidden && available(c.id)).length

  const onDragOver = (e: DragEvent, overIndex: number) => {
    if (!dragging) return
    e.preventDefault()
    const from = shown.findIndex((c) => c.id === dragging)
    if (from !== overIndex) setDraft(move(shown, from, overIndex))
  }
  const endDrag = () => {
    if (draft) onChange(draft)
    setDraft(null)
    setDragging(null)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>, index: number) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return
    e.preventDefault()
    const to = index + (e.key === "ArrowUp" ? -1 : 1)
    if (to < 0 || to >= columns.length) return
    onChange(move(columns, index, to))
    // The row re-renders in its new place; keep focus on it.
    const list = e.currentTarget.parentElement
    requestAnimationFrame(() => (list?.children[to] as HTMLElement | undefined)?.focus())
  }

  return (
    <ul className="column-list" aria-label="Columns, in order. Alt plus arrow keys moves the focused one.">
      {shown.map((c, i) => {
        const meta = COLUMNS[c.id]
        const enabled = available(c.id)
        const visible = !c.hidden && enabled
        return (
          <li
            key={c.id}
            className="column-row"
            data-dragging={dragging === c.id || undefined}
            data-hidden={!visible || undefined}
            draggable
            // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so Alt+arrows can move it.
            tabIndex={0}
            aria-label={`${meta.title}, ${i + 1} of ${shown.length}${visible ? "" : ", hidden"}`}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move"
              setDragging(c.id)
            }}
            onDragOver={(e) => onDragOver(e, i)}
            onDrop={(e) => e.preventDefault()}
            onDragEnd={endDrag}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <GripIcon className="column-grip" />
            <span className="column-icon">{meta.icon}</span>
            <span className="column-name">
              {meta.title}
              {!enabled && <span className="column-note">Needs LINEAR_API_KEY and LINEAR_WORKSPACE</span>}
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label={visible ? `Hide ${meta.title}` : `Show ${meta.title}`}
              aria-pressed={visible}
              disabled={!enabled || (visible && visibleCount === 1)}
              onClick={() => onChange(columns.map((x) => (x.id === c.id ? { ...x, hidden: !x.hidden } : x)))}
            >
              {visible ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Start and end of the workday, for "free time today". Saved only when start is before end. */
function WorkdayFields({
  value,
  onChange,
}: {
  value: Settings["workday"]
  onChange: (w: Settings["workday"]) => void
}) {
  const [draft, setDraft] = useState(value)
  const set = (part: "start" | "end", time: string) => {
    const next = { ...draft, [part]: time }
    setDraft(next)
    if (next.start && next.end && next.start < next.end) onChange(next)
  }
  const invalid = !(draft.start && draft.end && draft.start < draft.end)
  return (
    <div className="workday">
      <label>
        Starts
        <input type="time" value={draft.start} onChange={(e) => set("start", e.target.value)} />
      </label>
      <label>
        Ends
        <input type="time" value={draft.end} onChange={(e) => set("end", e.target.value)} />
      </label>
      {invalid && <span className="workday-error">The day must end after it starts.</span>}
    </div>
  )
}

/** Prompt for "Review in T3 Code" on PR rows. Empty means the default, shown as the placeholder. */
function ReviewPromptField() {
  const { custom, setCustom } = useReviewPrompt()
  return (
    <>
      <textarea
        id="review-prompt"
        className="capture-input review-prompt"
        value={custom}
        placeholder={DEFAULT_REVIEW_PROMPT}
        maxLength={REVIEW_PROMPT_MAX}
        rows={4}
        onChange={(e) => setCustom(e.target.value)}
      />
      <p className="settings-hint">
        T3 Code adds the PR's branch and review comments itself. Leave empty for the default.
      </p>
    </>
  )
}
