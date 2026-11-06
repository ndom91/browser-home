import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import type { ReactNode, RefObject } from "react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Shown next to the title, e.g. the target file or a key hint. */
  aside?: ReactNode
  /** Element to focus on open. Defaults to the first focusable one. */
  initialFocus?: RefObject<HTMLElement | null>
  children: ReactNode
}

/** Centered modal on Base UI. Esc and a backdrop click close it; focus returns to where it was. */
export function Dialog({ open, onOpenChange, title, aside, initialFocus, children }: Props) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="dialog-backdrop" />
        <BaseDialog.Popup className="dialog" initialFocus={initialFocus}>
          <header className="dialog-head">
            <BaseDialog.Title className="dialog-title">{title}</BaseDialog.Title>
            {aside != null && <span className="dialog-aside">{aside}</span>}
          </header>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
