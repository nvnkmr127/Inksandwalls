import * as React from "react"
import { cn } from "cn"

export interface RadioItemProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "onSelect"> {
  label?: string
  value: string
  checked?: boolean
  onSelect?: (value: string) => void
}

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
  name?: string
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, children, value, onValueChange, name, ...props }, ref) => {
    return (
      <div
        className={cn("grid gap-2", className)}
        role="radiogroup"
        ref={ref}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement<RadioItemProps>(child)) {
            return React.cloneElement(child, {
              name: child.props.name || name,
              checked: value !== undefined ? child.props.value === value : child.props.checked,
              onSelect: (val: string) => {
                child.props.onSelect?.(val)
                onValueChange?.(val)
              },
            })
          }
          return child
        })}
      </div>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioItemProps>(
  ({ className, label, value, checked, onSelect, disabled, name, ...props }, ref) => {
    return (
      <label
        className={cn(
          "inline-flex items-center gap-2 cursor-pointer select-none text-sm font-medium",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="relative flex items-center justify-center">
          <input
            type="radio"
            name={name}
            value={value}
            checked={checked}
            disabled={disabled}
            onChange={() => onSelect?.(value)}
            className="peer sr-only"
            ref={ref}
            {...props}
          />
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-input transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 peer-checked:border-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
              className
            )}
          >
            {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
          </span>
        </span>
        {label && <span>{label}</span>}
      </label>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
