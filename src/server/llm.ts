import tls from "node:tls"

// The inference host uses a certificate from a private CA in the macOS keychain.
// Node ignores the keychain by default, so trust it alongside the bundled roots.
tls.setDefaultCACertificates([...tls.getCACertificates("default"), ...tls.getCACertificates("system")])

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export function llmConfig() {
  const { LLM_BASE_URL, LLM_MODEL, LLM_API_KEY } = process.env
  if (!LLM_BASE_URL || !LLM_MODEL || !LLM_API_KEY) {
    const missing = Object.entries({ LLM_BASE_URL, LLM_MODEL, LLM_API_KEY })
      .filter(([, v]) => !v)
      .map(([k]) => k)
    return { error: `Missing ${missing.join(", ")}. Add them to .env (see .env.example).` } as const
  }
  return { baseUrl: LLM_BASE_URL.replace(/\/$/, ""), model: LLM_MODEL, apiKey: LLM_API_KEY } as const
}

const systemPrompt = () =>
  `You are a concise assistant on the user's browser start page. Today is ${new Date().toDateString()}. ` +
  "Answer briefly. Use Markdown only when it helps: short lists, code blocks."

/**
 * Streams the answer as plain text. Unwraps the OpenAI-style SSE stream on the
 * server, so the browser only reads text chunks.
 */
export async function streamChat(
  messages: Array<ChatMessage>,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const config = llmConfig()
  if ("error" in config) throw new Error(config.error)

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      messages: [{ role: "system", content: systemPrompt() }, ...messages],
    }),
  })
  if (!res.ok || !res.body) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`)

  const encoder = new TextEncoder()
  let buffer = ""
  return res.body.pipeThrough(new TextDecoderStream()).pipeThrough(
    new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        buffer += chunk
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data:")) continue
          const payload = line.slice(5).trim()
          if (!payload || payload === "[DONE]") continue
          const content = JSON.parse(payload).choices?.[0]?.delta?.content
          if (content) controller.enqueue(encoder.encode(content))
        }
      },
    }),
  )
}
