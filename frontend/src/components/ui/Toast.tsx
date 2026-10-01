import React, { createContext, useContext, useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  title: string
  message?: string
  type: ToastType
}

interface ToastContextType {
  toasts: ToastMessage[]
  showToast: (title: string, message?: string, type?: ToastType) => void
  removeToast: (id: string) => void
}

type ToastListener = (title: string, message?: string, type?: ToastType) => void
const toastListeners = new Set<ToastListener>()

export const globalToast = {
  show: (title: string, message?: string, type: ToastType = 'info') => {
    toastListeners.forEach((fn) => {
      try {
        fn(title, message, type)
      } catch {
        // ignore
      }
    })
  },
  success: (title: string, message?: string) => {
    globalToast.show(title, message, 'success')
  },
  error: (title: string, message?: string) => {
    globalToast.show(title, message, 'error')
  },
  warning: (title: string, message?: string) => {
    globalToast.show(title, message, 'warning')
  },
  info: (title: string, message?: string) => {
    globalToast.show(title, message, 'info')
  },
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (title: string, message?: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).substring(2, 9)
      setToasts((prev) => [...prev, { id, title, message, type }])

      setTimeout(() => {
        removeToast(id)
      }, 4500)
    },
    [removeToast]
  )

  React.useEffect(() => {
    const listener: ToastListener = (title, message, type) => {
      showToast(title, message, type)
    }
    toastListeners.add(listener)
    return () => {
      toastListeners.delete(listener)
    }
  }, [showToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const typeStyles = {
            success: 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200',
            error: 'bg-red-950/90 border-red-700/80 text-red-200',
            warning: 'bg-amber-950/90 border-amber-700/80 text-amber-200',
            info: 'bg-[#131b2e]/90 border-[#222e47] text-slate-200',
          }[toast.type]

          return (
            <div
              key={toast.id}
              className={`p-3.5 rounded-lg border shadow-xl backdrop-blur-md pointer-events-auto transition-all transform translate-y-0 opacity-100 flex items-start justify-between gap-3 ${typeStyles}`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide">{toast.title}</p>
                {toast.message && <p className="text-xs mt-0.5 opacity-90">{toast.message}</p>}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-xs opacity-60 hover:opacity-100 p-0.5"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
