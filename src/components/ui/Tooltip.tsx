import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip"
import type { ReactElement, ReactNode } from "react"

interface Props {
  content: ReactNode
  align?: "start" | "center" | "end"
  className?: string
  /** The element that triggers the tooltip. It keeps its own tag and props. */
  children: ReactElement
}

/**
 * Small hover/focus hint. Timing follows transitions.dev's tooltip: an 80ms
 * appear delay lives in CSS (--tt-delay), so Base UI opens at once.
 */
export function Tooltip({ content, align = "center", className, children }: Props) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={0} closeDelay={0} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner className="tooltip-positioner" side="bottom" align={align} sideOffset={8}>
          <BaseTooltip.Popup className={className ? `tooltip ${className}` : "tooltip"}>{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
