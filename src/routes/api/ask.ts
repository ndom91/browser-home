import { chat, toServerSentEventsResponse } from "@tanstack/ai"
import { createFileRoute } from "@tanstack/react-router"
import { llmAdapter, systemPrompt } from "../../server/llm"

const MAX_MESSAGES = 40
const MAX_BODY_BYTES = 256_000

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } })

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Any website can POST to localhost. Only accept requests from this page,
        // so others can't spend the model's time with our API key.
        if (request.headers.get("sec-fetch-site") !== "same-origin") return text("forbidden", 403)

        const raw = await request.text()
        if (raw.length > MAX_BODY_BYTES) return text("Conversation too long. Clear it and start over.", 413)
        const body = JSON.parse(raw || "null") as { messages?: unknown; threadId?: string } | null
        if (!Array.isArray(body?.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES)
          return text("Expected { messages: [...] }", 400)

        const llm = llmAdapter()
        if (!llm.ok) return text(llm.error, 503)

        // Stop generating upstream when the user hits Stop or closes the tab.
        const abortController = new AbortController()
        request.signal.addEventListener("abort", () => abortController.abort())

        const stream = chat({
          adapter: llm.adapter,
          messages: body.messages,
          threadId: body.threadId ?? crypto.randomUUID(),
          systemPrompts: [systemPrompt()],
          abortController,
        })
        return toServerSentEventsResponse(stream, { abortController })
      },
    },
  },
})
