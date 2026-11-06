import tls from "node:tls"
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible"

// The inference host uses a certificate from a private CA in the macOS keychain.
// Node ignores the keychain by default, so trust it alongside the bundled roots.
tls.setDefaultCACertificates([...tls.getCACertificates("default"), ...tls.getCACertificates("system")])

/** The chat adapter, or an error naming the missing env vars. */
export function llmAdapter() {
  const { LLM_BASE_URL, LLM_MODEL, LLM_API_KEY } = process.env
  if (!LLM_BASE_URL || !LLM_MODEL || !LLM_API_KEY) {
    const missing = Object.entries({ LLM_BASE_URL, LLM_MODEL, LLM_API_KEY })
      .filter(([, v]) => !v)
      .map(([k]) => k)
    return { ok: false, error: `Missing ${missing.join(", ")}. Add them to .env (see .env.example).` } as const
  }
  return { ok: true, adapter: openaiCompatibleText(LLM_MODEL, { baseURL: LLM_BASE_URL, apiKey: LLM_API_KEY }) } as const
}

export const systemPrompt = () =>
  `You are a concise assistant on the user's browser start page. Today is ${new Date().toDateString()}. ` +
  "Answer briefly. Use Markdown only when it helps: short lists, code blocks."
