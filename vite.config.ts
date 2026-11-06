import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Server code reads secrets (LLM_API_KEY) from process.env. Vite only loads
// VITE_-prefixed vars, so load .env ourselves. Existing env vars win.
try {
  process.loadEnvFile()
} catch {
  // No .env: fine, the LLM prompt reports what's missing.
}

export default defineConfig({
  server: { port: 6464, host: "127.0.0.1", strictPort: true },
  plugins: [tanstackStart(), viteReact()],
})
