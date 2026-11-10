import { useRouteContext } from "@tanstack/react-router"
import { type FormEvent, useEffect, useRef } from "react"
import { clock, firstName, greeting, longDay } from "../lib/format"
import type { Weather } from "../lib/types"
import { useNow } from "../lib/useNow"
import { weatherKind } from "../lib/weather"
import { CogIcon, SearchIcon, WeatherIcon } from "./icons"
import { Tooltip } from "./ui/Tooltip"

// "example.com", "localhost:3000/x", "192.168.1.1" — anything URL-shaped without spaces.
const HOSTLIKE = /^(localhost|[\w-]+(\.[\w-]+)+|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/\S*)?$/i

function destination(input: string, searchUrl: string) {
  const q = input.trim()
  if (/^[a-z][\w+.-]*:\/\//i.test(q)) return q
  if (HOSTLIKE.test(q)) return `${q.startsWith("localhost") ? "http" : "https"}://${q}`
  return searchUrl + encodeURIComponent(q)
}

export function Header({
  name,
  weather,
  onSettings,
}: {
  name: string | null
  weather: Weather | undefined
  onSettings: () => void
}) {
  const now = useNow()
  const { searchUrl } = useRouteContext({ from: "__root__" })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = inputRef.current
    if (!input?.value.trim()) return
    window.open(destination(input.value, searchUrl), "_blank", "noopener,noreferrer")
    input.value = ""
  }

  return (
    <header className="top">
      <h1>
        {greeting(now)}
        {name ? `, ${firstName(name)}` : ""}
        <span className="top-date">
          {longDay(now)} · {clock(now)}
        </span>
      </h1>
      <div className="top-right">
        {weather && <WeatherBadge weather={weather} />}
        {/* biome-ignore lint/a11y/useSemanticElements: role="search" on the form is valid, and a <search> wrapper would break the .search flex layout. */}
        <form className="search" role="search" onSubmit={onSubmit}>
          <SearchIcon className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            name="q"
            placeholder="Search or type a URL"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search or type a URL"
          />
          <kbd>⌘K</kbd>
        </form>
        <Tooltip
          content={
            <>
              Settings <kbd>,</kbd>
            </>
          }
        >
          <button type="button" className="icon-btn top-settings" aria-label="Settings" onClick={onSettings}>
            <CogIcon />
          </button>
        </Tooltip>
      </div>
    </header>
  )
}

function WeatherBadge({ weather }: { weather: Weather }) {
  const { kind, label } = weatherKind(weather.code)
  const summary = `Today in Berlin: ${label}, high ${weather.max}°, low ${weather.min}°`
  return (
    <Tooltip content={summary}>
      {/* Focusable so the tooltip also opens from the keyboard. */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the tooltip is the interaction. */}
      <div className="weather" tabIndex={0}>
        <WeatherIcon kind={kind} />
        <span className="weather-max" aria-hidden="true">
          {weather.max}°
        </span>
        <span className="weather-sep" aria-hidden="true">
          /
        </span>
        <span className="weather-min" aria-hidden="true">
          {weather.min}°
        </span>
        <span className="sr-only">{summary}</span>
      </div>
    </Tooltip>
  )
}
