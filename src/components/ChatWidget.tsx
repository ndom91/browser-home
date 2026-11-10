import { fetchServerSentEvents, type UIMessage, useChat } from "@tanstack/ai-react"
import { streamingMarkdownExtension } from "@tanstack/markdown/extensions/streaming"
import { Markdown } from "@tanstack/markdown/react"
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, SparkHexIcon, StopIcon } from "./icons"
import { STREAMING_COMPONENTS, ThinkingLine } from "./ui/motion"

const connection = fetchServerSentEvents("/api/ask")
// Created once: the extension keeps half-written Markdown stable while it streams.
const markdownExtensions = [streamingMarkdownExtension()]

const textOf = (m: UIMessage) =>
  m.parts
    .map((p) => (p.type === "text" ? p.content : ""))
    .join("")
    .trim()

type Part = UIMessage["parts"][number]
type ToolCall = Extract<Part, { type: "tool-call" }>
type ToolResult = Extract<Part, { type: "tool-result" }>

const hasTools = (m: UIMessage) => m.parts.some((p) => p.type === "tool-call")

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

  const visible = messages.filter((m) => m.role === "user" || textOf(m) || hasTools(m))
  const open = visible.length > 0 && !collapsed
  const last = messages.at(-1)
  const lastPart = last?.role === "assistant" ? last.parts.at(-1) : undefined
  // "Thinking" until text streams, except while a tool row shows its own spinner.
  const toolRunning = lastPart?.type === "tool-call"
  const thinking = isLoading && !toolRunning && !(lastPart?.type === "text" && lastPart.content.trim())

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
          <Thread
            messages={visible}
            thinking={thinking}
            streaming={isLoading}
            failed={status === "error"}
            onRetry={() => void reload()}
          />
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
  streaming,
  failed,
  onRetry,
}: {
  messages: Array<UIMessage>
  thinking: boolean
  streaming: boolean
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
  const lastParts = last?.parts.length ?? 0
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on new content, which these values track.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
    onScroll()
  }, [messages.length, lastText, lastParts, thinking, failed])

  return (
    <div className="chat-thread" ref={scrollRef} onScroll={onScroll}>
      {earlier > 0 && (
        <p className="chat-earlier">
          {earlier} earlier {earlier === 1 ? "message" : "messages"}
        </p>
      )}
      {messages.map((m, i) =>
        m.role === "user" ? (
          <p key={m.id} className="chat-msg chat-user">
            {textOf(m)}
          </p>
        ) : (
          <div key={m.id} className="chat-msg chat-answer">
            <AnswerParts message={m} streaming={streaming && i === messages.length - 1} />
          </div>
        ),
      )}
      {thinking && (
        <p className="chat-thinking" aria-live="polite">
          <ThinkingLine />
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

/** Text and tool calls in the order the model produced them. Results attach to their call. */
function AnswerParts({ message, streaming }: { message: UIMessage; streaming: boolean }) {
  const results = new Map<string, ToolResult>()
  for (const p of message.parts) if (p.type === "tool-result") results.set(p.toolCallId, p)

  return message.parts.map((p, i) => {
    const key = `${message.id}-${i}`
    if (p.type === "tool-call") return <ToolRow key={key} call={p} result={results.get(p.id)} streaming={streaming} />
    if (p.type !== "text" || !p.content.trim()) return null
    return (
      <Markdown key={key} extensions={markdownExtensions} components={streaming ? STREAMING_COMPONENTS : undefined}>
        {p.content}
      </Markdown>
    )
  })
}

// "homeassistant__HassTurnOn" → "Turn on", "GetLiveContext" → "Get live context".
const toolLabel = (name: string) => {
  const words = (name.split("__").at(-1) ?? name)
    .replace(/^Hass(?=[A-Z])/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

const pretty = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value, null, 2))

/** One-line "key: value · key: value" from the scalar arguments. */
const argSummary = (args: unknown) =>
  args && typeof args === "object"
    ? Object.entries(args)
        .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ")
    : ""

const resultText = (result: ToolResult | undefined, call: ToolCall) => {
  if (result?.error) return result.error
  const raw = result
    ? typeof result.content === "string"
      ? result.content
      : result.content.map((c) => (c.type === "text" ? c.content : "")).join("\n")
    : call.output
  if (raw === undefined) return ""
  return pretty(unwrap(typeof raw === "string" ? parseJson(raw) : raw))
}

// Results often arrive wrapped: HA's { result: "…" } or raw MCP { content: [{ type: "text", text: "<json>" }] }.
// Peel those layers so the row shows the payload itself.
const unwrap = (value: unknown): unknown => {
  if (!value || typeof value !== "object") return value
  const v = value as { result?: unknown; content?: unknown }
  if (Object.keys(v).length === 1 && "result" in v) return unwrap(v.result)
  if (Array.isArray(v.content) && v.content.every((c) => c?.type === "text")) {
    const texts = v.content.map((c: { text: string }) => c.text)
    return texts.length === 1 ? unwrap(parseJson(texts[0])) : texts.join("\n")
  }
  return value
}

function ToolRow({ call, result, streaming }: { call: ToolCall; result?: ToolResult; streaming: boolean }) {
  const args = call.input ?? parseJson(call.arguments)
  const failed = call.state === "error" || result?.state === "error"
  const done = !failed && (result?.state === "complete" || call.output !== undefined)
  // A stopped run leaves the call without a result; don't spin forever.
  const status = failed ? "error" : done ? "done" : streaming ? "running" : "stopped"
  const summary = argSummary(args)
  const output = resultText(result, call)

  return (
    <details className={`chat-tool is-${status}`}>
      <summary>
        <span className="chat-tool-status" aria-hidden="true">
          {status === "done" ? (
            <CheckIcon />
          ) : status === "running" ? (
            <span className="chat-tool-spinner" />
          ) : (
            <span className="chat-tool-dot" />
          )}
        </span>
        <span className="chat-tool-name">{toolLabel(call.name)}</span>
        {summary && <span className="chat-tool-args">{summary}</span>}
        <ChevronRightIcon className="chat-tool-chevron" />
      </summary>
      <div className="chat-tool-body">
        <p className="chat-tool-label">{call.name}</p>
        <pre>{pretty(args) || "{}"}</pre>
        {output && (
          <>
            <p className="chat-tool-label">{failed ? "Error" : "Result"}</p>
            <pre className="chat-tool-output">{output}</pre>
          </>
        )}
      </div>
    </details>
  )
}
