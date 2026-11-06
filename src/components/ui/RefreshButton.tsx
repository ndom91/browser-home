import { useMutation, useQueryClient } from "@tanstack/react-query"
import { RefreshIcon } from "../icons"
import { Tooltip } from "./Tooltip"

interface Props {
  /** The query to overwrite with the fresh result, e.g. ["prs"]. */
  queryKey: Array<string>
  /** A server fn that skips the server cache. */
  refresh: () => Promise<unknown>
  /** What gets refreshed, for the label: "stories", "pull requests". */
  what: string
}

/** Icon button that force-refreshes one source. Spins while loading; the old data stays on failure. */
export function RefreshButton({ queryKey, refresh, what }: Props) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: refresh,
    onSuccess: (fresh) => queryClient.setQueryData(queryKey, fresh),
  })
  const label = `Refresh ${what}`
  return (
    <Tooltip content={mutation.isError ? "Refresh failed, try again" : label}>
      <button
        type="button"
        className={`icon-btn${mutation.isPending ? " is-spinning" : ""}`}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        aria-label={label}
        data-refresh
      >
        <RefreshIcon />
      </button>
    </Tooltip>
  )
}
