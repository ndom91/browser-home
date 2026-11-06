import { fetchServerSentEvents, type UIMessage, useChat } from "@tanstack/ai-react"
import { streamingMarkdownExtension } from "@tanstack/markdown/extensions/streaming"
import { Markdown } from "@tanstack/markdown/react"
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowUpIcon, ChevronDownIcon, SparkHexIcon, StopIcon } from "./icons"

const connection = fetchServerSentEvents("/api/ask")
// Created once: the extension keeps half-written Markdown stable while it streams.
const markdownExtensions = [streamingMarkdownExtension()]

const textOf = (m: UIMessage) =>
  m.parts
    .map((p) => (p.type === "text" ? p.content : ""))
    .join("")
    .trim()

/**
 * Floating "Quick question" box for the local LLM. It's anchored to the bottom
 * of the page and the thread grows upward, so the input never moves.
 */
export function ChatWidget() {
  const [threadId] = useState(() => crypto.randomUUID())
  const { messages, sendMessage, stop, reload, clear, status, isLoading } = useChat({ connection, threadId })
  const [draft, setDraft] = useState("")
  const [collapsed, setCollapsed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const visible = messages.filter((m) => m.role === "user" || textOf(m))
  const open = visible.length > 0 && !collapsed
  const last = messages.at(-1)
  // "Thinking" until the first token of the answer arrives.
  const thinking = isLoading && (!last || last.role === "user" || !textOf(last))

  // "/" focuses the box from anywhere, unless you're already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t.closest("input, textarea, [contenteditable]")) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Esc hides the thread wherever focus is; the count pill brings it back. Capture phase plus
  // stopPropagation, so the HN panel's own Esc doesn't also close a thread underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (open) {
        e.stopPropagation()
        setCollapsed(true)
      } else if (e.target === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || isLoading) return
    setDraft("")
    setCollapsed(false)
    void sendMessage(text)
  }

  const reset = () => {
    stop()
    clear()
    setCollapsed(false)
    inputRef.current?.focus()
  }

  return (
    <div className={`chat${open ? " is-open" : ""}`}>
      {open && (
        <>
          <header className="chat-head">
            <SparkHexIcon className="chat-icon" />
            <span className="chat-title">Quick question</span>
            <button type="button" className="chat-head-btn" onClick={reset}>
              Clear
            </button>
            <button
              type="button"
              className="chat-head-btn is-icon"
              onClick={() => setCollapsed(true)}
              aria-label="Hide conversation"
            >
              <ChevronDownIcon />
            </button>
          </header>
          <Thread messages={visible} thinking={thinking} failed={status === "error"} onRetry={() => void reload()} />
        </>
      )}

      <form className="chat-bar" onSubmit={submit}>
        {visible.length > 0 && collapsed ? (
          <button type="button" className="chat-count" onClick={() => setCollapsed(false)}>
            {visible.length} {visible.length === 1 ? "msg" : "msgs"}
          </button>
        ) : (
          <SparkHexIcon className="chat-icon" />
        )}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={visible.length ? "Ask a follow-up…" : "Ask anything…"}
          aria-label="Ask the local model"
          autoComplete="off"
        />
        <kbd>{draft ? "↵" : "/"}</kbd>
        {isLoading ? (
          <button type="button" className="chat-send is-stop" onClick={stop} aria-label="Stop">
            <StopIcon />
          </button>
        ) : (
          <button type="submit" className={`chat-send${draft.trim() ? " is-ready" : ""}`} aria-label="Send">
            <ArrowUpIcon />
          </button>
        )}
      </form>
    </div>
  )
}

function Thread({
  messages,
  thinking,
  failed,
  onRetry,
}: {
  messages: Array<UIMessage>
  thinking: boolean
  failed: boolean
  onRetry: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const [earlier, setEarlier] = useState(0)

  // Count the messages that have scrolled out of view above, for the "N earlier" label.
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    const items = el.querySelectorAll<HTMLElement>(".chat-msg")
    setEarlier([...items].filter((m) => m.offsetTop + m.offsetHeight <= el.scrollTop + 24).length)
  }

  // Follow the stream, unless the user scrolled up to read.
  const last = messages.at(-1)
  const lastText = last ? textOf(last) : ""
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on new content, which these values track.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
    onScroll()
  }, [messages.length, lastText, thinking, failed])

  return (
    <div className="chat-thread" ref={scrollRef} onScroll={onScroll}>
      {earlier > 0 && (
        <p className="chat-earlier">
          {earlier} earlier {earlier === 1 ? "message" : "messages"}
        </p>
      )}
      {messages.map((m) =>
        m.role === "user" ? (
          <p key={m.id} className="chat-msg chat-user">
            {textOf(m)}
          </p>
        ) : (
          <div key={m.id} className="chat-msg chat-answer">
            <Markdown extensions={markdownExtensions}>{textOf(m)}</Markdown>
          </div>
        ),
      )}
      {thinking && (
        <p className="chat-thinking" aria-live="polite">
          <span className="chat-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Thinking
        </p>
      )}
      {failed && (
        <p className="chat-error" role="alert">
          <span className="chat-error-dot" aria-hidden="true" />
          Couldn't get an answer.
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}
    </div>
  )
}
