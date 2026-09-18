"use client"

import * as React from "react"
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react"
import { cn } from "cn"

export type ToastType = "success" | "error" | "warning" | "info"

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextType {
  toasts: ToastMessage[]
  addToast: (toast: Omit<ToastMessage, "id">) => string
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

let toastListener: ((toast: Omit<ToastMessage, "id">) => void) | null = null

export const toast = {
  success: (title: string, description?: string, duration?: number) => {
    toastListener?.({ type: "success", title, description, duration })
  },
  error: (title: string, description?: string, duration?: number) => {
    toastListener?.({ type: "error", title, description, duration })
  },
  warning: (title: string, description?: string, duration?: number) => {
    toastListener?.({ type: "warning", title, description, duration })
  },
  info: (title: string, description?: string, duration?: number) => {
    toastListener?.({ type: "info", title, description, duration })
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = React.useCallback(
    (toastData: Omit<ToastMessage, "id">) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const newToast: ToastMessage = { ...toastData, id }
      setToasts((prev) => [...prev, newToast])

      const autoDismiss = toastData.duration ?? 4000
      if (autoDismiss > 0) {
        setTimeout(() => {
          removeToast(id)
        }, autoDismiss)
      }
      return id
    },
    [removeToast]
  )

  React.useEffect(() => {
    toastListener = addToast
    return () => {
      toastListener = null
    }
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return ctx
}

function ToastItem({
  toast: t,
  onClose,
}: {
  toast: ToastMessage
  onClose: () => void
}) {
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-destructive shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-sky-500 shrink-0" />,
  }

  const borderVariants = {
    success: "border-emerald-500/20 bg-background",
    error: "border-destructive/20 bg-background",
    warning: "border-amber-500/20 bg-background",
    info: "border-sky-500/20 bg-background",
  }

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-bottom-2 text-foreground",
        borderVariants[t.type]
      )}
      role="alert"
    >
      {icons[t.type]}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold tracking-tight">{t.title}</h4>
        {t.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
