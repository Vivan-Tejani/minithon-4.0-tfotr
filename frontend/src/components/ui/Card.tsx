import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  variant?: 'default' | 'elevated' | 'glass' | 'alert'
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const bgStyles = {
    default: 'bg-[#0d131f] border-[#1c2638]',
    elevated: 'bg-[#131b2e] border-[#222e47]',
    glass: 'bg-[#0d131f]/80 backdrop-blur-md border-[#1c2638]',
    alert: 'bg-red-950/20 border-red-900/40',
  }[variant]

  return (
    <div
      className={`rounded-lg border p-4 transition-all duration-150 ${bgStyles} ${className}`}
      {...props}
    >
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-3 mb-3 border-b border-[#1c2638]/60 pb-2.5">
          <div>
            {title && (
              <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
