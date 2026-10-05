import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  width?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
  footer?: React.ReactNode
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  width = 'md',
  children,
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const widthStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  }[width]

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex pl-10" role="dialog" aria-modal="true">
        <div
          className={`w-screen ${widthStyles} bg-[#0e0e10] border-l border-zinc-800 shadow-2xl flex flex-col justify-between transform transition-transform ease-out duration-200`}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
            <div>
              {title && (
                <h2 className="text-sm font-medium text-zinc-100">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-zinc-300">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
