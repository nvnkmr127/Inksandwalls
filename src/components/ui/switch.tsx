import * as React from "react"
import { cn } from "cn"

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: string
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled, label, ...props }, ref) => {
    return (
      <label
        className={cn(
          "inline-flex items-center gap-2 cursor-pointer select-none text-sm font-medium",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="relative inline-flex items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            ref={ref}
            {...props}
          />
          <span
            className={cn(
              "inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 peer-checked:bg-primary bg-input peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
              className
            )}
          >
            <span
              className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform translate-x-0 peer-checked:translate-x-4"
              )}
              style={{
                transform: checked ? "translateX(1rem)" : "translateX(0)",
              }}
            />
          </span>
        </span>
        {label && <span>{label}</span>}
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
