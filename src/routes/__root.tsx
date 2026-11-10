/// <reference types="vite/client" />
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import { type ReactNode, useState } from "react"
import { SettingsProvider, useSettingsState } from "../lib/useSettings"
import { getSearchUrl, getSettings } from "../server/fns"
import appCss from "../styles.css?url"

const FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='6' fill='%2322c55e'/></svg>"

export const Route = createRootRoute({
  // Read here, so the whole page (theme included) renders with them from the first paint.
  beforeLoad: async () => {
    const [settings, searchUrl] = await Promise.all([getSettings(), getSearchUrl()])
    return { settings, searchUrl }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light dark" },
      { title: "Home" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: FAVICON },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchIntervalInBackground: false,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  const settings = useSettingsState(Route.useRouteContext().settings)
  const { theme } = settings.settings
  return (
    <html lang="en" data-theme={theme === "system" ? undefined : theme}>
      <head>
        <HeadContent />
      </head>
      <body>
        <SettingsProvider value={settings}>{children}</SettingsProvider>
        <Scripts />
      </body>
    </html>
  )
}
