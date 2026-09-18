import * as React from "react"
import { Label } from "./label"
import { cn } from "cn"

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  htmlFor?: string
  required?: boolean
  description?: string
  error?: string
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, label, htmlFor, required, description, error, children, ...props }, ref) => {
    return (
      <div className={cn("space-y-1.5", className)} ref={ref} {...props}>
        {label && (
          <div className="flex items-center justify-between">
            <Label htmlFor={htmlFor} className="text-foreground font-medium">
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
          </div>
        )}
        {children}
        {description && !error && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    )
  }
)
FormField.displayName = "FormField"

export { FormField }
