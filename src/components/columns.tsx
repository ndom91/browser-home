import type { ReactNode } from "react"
import type { ColumnId } from "../lib/settings"
import { CalendarIcon, GitHubIcon, HackerNewsIcon, LinearIcon } from "./icons"

/** Names and icons per column, for the settings list and the shortcuts sheet. */
export const COLUMNS: Record<ColumnId, { title: string; short: string; icon: ReactNode }> = {
  calendar: { title: "Today", short: "Today", icon: <CalendarIcon /> },
  linear: { title: "My issues", short: "issues", icon: <LinearIcon /> },
  prs: { title: "Pull requests", short: "PRs", icon: <GitHubIcon /> },
  hn: { title: "Hacker News", short: "Hacker News", icon: <HackerNewsIcon /> },
}
