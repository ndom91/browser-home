import { useMutation } from "@tanstack/react-query"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { captureNote } from "../server/fns"
import { Dialog } from "./ui/Dialog"

/** Jot a thought into this week's Obsidian note. "c" opens it; Enter saves, Shift+Enter adds a line. */
export function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  // The note name outlives the toast, so the text stays put while it fades out.
  const [savedTo, setSavedTo] = useState<string | null>(null)
  const [toast, setToast] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const save = useMutation({
    mutationFn: (value: string) => captureNote({ data: value }),
    onSuccess: ({ note }) => {
      setText("")
      setSavedTo(note)
      setToast(true)
      setOpen(false)
    },
  })

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(false), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  // "c" opens capture from anywhere, unless you're already typing somewhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, [contenteditable]")) return
      e.preventDefault()
      save.reset()
      setOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [save.reset])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (text.trim() && !save.isPending) save.mutate(text)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen} title="Quick capture" aside="This week's note" initialFocus={inputRef}>
        <textarea
          ref={inputRef}
          className="capture-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="A thought, a todo, a link…"
          rows={3}
          maxLength={2000}
          aria-label="Note"
        />
        <footer className="capture-foot">
          {save.isError ? (
            <span className="capture-error" role="alert">
              {save.error instanceof Error ? save.error.message : "Couldn't save"}
            </span>
          ) : (
            <span className="capture-hint">
              <kbd>↵</kbd> save <kbd>⇧↵</kbd> new line <kbd>esc</kbd> cancel
            </span>
          )}
        </footer>
      </Dialog>
      <output className={`capture-toast${toast ? " is-shown" : ""}`} aria-live="polite">
        {savedTo && `Saved to ${savedTo}`}
      </output>
    </>
  )
}
