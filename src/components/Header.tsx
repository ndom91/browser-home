import { type FormEvent, useEffect, useRef } from "react"
import { clock, firstName, greeting, longDay } from "../lib/format"
import { useNow } from "../lib/useNow"
import { SearchIcon } from "./icons"

// "example.com", "localhost:3000/x", "192.168.1.1" — anything URL-shaped without spaces.
const HOSTLIKE = /^(localhost|[\w-]+(\.[\w-]+)+|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/\S*)?$/i

function destination(input: string) {
  const q = input.trim()
  if (/^[a-z][\w+.-]*:\/\//i.test(q)) return q
  if (HOSTLIKE.test(q)) return `${q.startsWith("localhost") ? "http" : "https"}://${q}`
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

export function Header({ name }: { name: string | null }) {
  const now = useNow()
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
    const value = inputRef.current?.value ?? ""
    if (value.trim()) window.location.assign(destination(value))
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
    </header>
  )
}
