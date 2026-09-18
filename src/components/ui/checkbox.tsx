import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "cn"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <label
        className={cn(
          "inline-flex items-center gap-2 cursor-pointer select-none text-sm font-medium",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="relative flex items-center justify-center">
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
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
              className
            )}
          >
            {checked && <Check className="h-3 w-3 stroke-[3]" />}
          </span>
        </span>
      </label>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
