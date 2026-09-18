import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "cn"

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  )
}

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
  label?: string
}

export function LoadingSpinner({
  size = "md",
  label = "Loading...",
  className,
  ...props
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-10 w-10",
  }

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-2 text-muted-foreground", className)}
      role="status"
      {...props}
    >
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
      {label && <span className="text-xs font-medium">{label}</span>}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  variant?: "spinner" | "skeleton" | "page"
}

export function LoadingState({
  title = "Loading data...",
  description,
  variant = "spinner",
  className,
  ...props
}: LoadingStateProps) {
  if (variant === "page") {
    return (
      <div
        className={cn("flex min-h-[50vh] flex-col items-center justify-center p-8 text-center", className)}
        {...props}
      >
        <LoadingSpinner size="lg" label={title} />
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
    )
  }

  if (variant === "skeleton") {
    return (
      <div className={cn("space-y-3 p-4", className)} {...props}>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-center justify-center p-6 text-center", className)} {...props}>
      <LoadingSpinner size="md" label={title} />
      {description && <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}
