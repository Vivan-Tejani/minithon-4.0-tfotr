import React, { useEffect } from 'react'

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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex pl-10" role="dialog" aria-modal="true">
        <div
          className={`w-screen ${widthStyles} bg-[#0a0f1d] border-l border-[#1c2638] shadow-2xl flex flex-col justify-between transform transition-transform ease-out duration-200`}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#1c2638] flex items-center justify-between bg-[#0d1322]">
            <div>
              {title && (
                <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wide">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#1a233a] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 transition-colors cursor-pointer"
              aria-label="Close drawer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-300">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-3.5 border-t border-[#1c2638] bg-[#0d1322] flex items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
