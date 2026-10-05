import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  variant?: 'default' | 'elevated' | 'glass' | 'alert' | 'metric'
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 transition-colors ${className}`}
      {...props}
    >
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-zinc-800/60">
          <div>
            {title && (
              <h3 className="text-sm font-medium tracking-normal text-zinc-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-zinc-400 mt-1">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`flex flex-col space-y-1.5 mb-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <h3
      className={`text-sm font-medium leading-none text-zinc-100 ${className}`}
      {...props}
    >
      {children}
    </h3>
  )
}

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <p className={`text-xs text-zinc-400 mt-1 ${className}`} {...props}>
      {children}
    </p>
  )
}

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`p-0 ${className}`} {...props}>
      {children}
    </div>
  )
}

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`flex items-center pt-4 border-t border-zinc-800/60 ${className}`} {...props}>
      {children}
    </div>
  )
}
