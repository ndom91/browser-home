import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  server: { port: 6464, host: "127.0.0.1", strictPort: true },
  plugins: [tanstackStart(), viteReact()],
})
