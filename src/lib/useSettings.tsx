import { createContext, type ReactNode, useContext, useState } from "react"
import { DEFAULT_SETTINGS, type Settings, settingsCookie } from "./settings"

const SettingsContext = createContext<{ settings: Settings; update: (next: Settings) => void }>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
})

/** Holds the settings the server read from the cookie. Updates write the cookie back. */
export function useSettingsState(initial: Settings) {
  const [settings, setSettings] = useState(initial)
  const update = (next: Settings) => {
    setSettings(next)
    // biome-ignore lint/suspicious/noDocumentCookie: a synchronous write, so a reload right after already sees it.
    document.cookie = settingsCookie(next)
  }
  return { settings, update }
}

export function SettingsProvider({
  value,
  children,
}: {
  value: ReturnType<typeof useSettingsState>
  children: ReactNode
}) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)
