import { createFileRoute } from "@tanstack/react-router"
import { type ChatMessage, streamChat } from "../../server/llm"

const MAX_MESSAGES = 40
const MAX_CHARS = 16_000

function parseMessages(body: unknown): Array<ChatMessage> | null {
  const messages = (body as { messages?: unknown } | null)?.messages
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null
  const valid = messages.every(
    (m) =>
      (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.length <= MAX_CHARS,
  )
  return valid ? messages.map((m) => ({ role: m.role, content: m.content })) : null
}

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } })

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Any website can POST to localhost. Only accept requests from this page,
        // so others can't spend the model's time with our API key.
        const site = request.headers.get("sec-fetch-site")
        if (site !== "same-origin") return text("forbidden", 403)

        const messages = parseMessages(await request.json().catch(() => null))
        if (!messages) return text("Expected { messages: [{ role, content }] }", 400)

        try {
          const stream = await streamChat(messages, request.signal)
          return new Response(stream, {
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          })
        } catch (err) {
          return text(err instanceof Error ? err.message : String(err), 502)
        }
      },
    },
  },
})
