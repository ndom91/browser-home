import tls from "node:tls"
import type { ChatMCPOptions } from "@tanstack/ai"
import { createMCPClient } from "@tanstack/ai-mcp"
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible"
import { CONFIG_PATH, config } from "./config"

// The inference host uses a certificate from a private CA in the macOS keychain.
// Node ignores the keychain by default, so trust it alongside the bundled roots.
tls.setDefaultCACertificates([...tls.getCACertificates("default"), ...tls.getCACertificates("system")])

const LLM_KEYS = ["base_url", "model", "api_key"] as const

/** The llm.* keys that config.yaml still lacks. */
export const missingLlmKeys = () => {
  const { llm } = config()
  return LLM_KEYS.filter((key) => !llm[key]).map((key) => `llm.${key}`)
}

/** The chat adapter, or an error naming the missing config keys. */
export function llmAdapter() {
  const missing = missingLlmKeys()
  if (missing.length) {
    return { ok: false, error: `Missing ${missing.join(", ")}. Add them to ${CONFIG_PATH}.` } as const
  }
  const { base_url, model, api_key } = config().llm
  return { ok: true, adapter: openaiCompatibleText(model, { baseURL: base_url, apiKey: api_key }) } as const
}

export const systemPrompt = () =>
  `You are a concise assistant on the user's browser start page. Today is ${new Date().toDateString()}. ` +
  "Answer briefly. Use Markdown only when it helps: short lists, code blocks."

/** Tools from every enabled MCP server in config.yaml. Servers that fail to connect are skipped. */
export async function mcpOptions(): Promise<ChatMCPOptions | undefined> {
  const servers = config().mcp.servers.filter((s) => s.enabled)
  const results = await Promise.allSettled(
    servers.map((s) =>
      createMCPClient({
        transport: { type: "http", url: s.url, headers: s.headers ?? {} },
        name: "browser-home",
        // "__" keeps two servers' same-named tools apart; the chat strips it for display.
        toolName: (tool) => `${s.name}__${tool.name}`,
      }),
    ),
  )
  const clients = results.flatMap((r, i) => {
    if (r.status === "fulfilled") return [r.value]
    console.warn(
      `MCP server "${servers[i].name}" (${servers[i].url}) failed to connect:`,
      r.reason instanceof Error ? r.reason.message : r.reason,
    )
    return []
  })
  if (!clients.length) return undefined
  return {
    clients,
    // One server failing to list its tools shouldn't take the whole chat down with it.
    onDiscoveryError: (error) => console.warn("MCP tool discovery failed:", error),
  }
}
