import React from 'react'

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'warning' | 'danger' | 'success' | 'outline' | 'ghost'
  size?: 'xs' | 'sm' | 'md'
  onRemove?: () => void
}

export const Chip: React.FC<ChipProps> = ({
  variant = 'default',
  size = 'sm',
  onRemove,
  className = '',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
    accent: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/50',
    warning: 'bg-amber-950/60 text-amber-300 border-amber-800/50',
    danger: 'bg-red-950/60 text-red-300 border-red-800/50',
    success: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50',
    outline: 'bg-transparent text-slate-300 border-slate-700',
    ghost: 'bg-transparent text-slate-400 border-transparent hover:text-slate-200',
  }[variant]

  const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-2',
  }[size]

  return (
    <span
      className={`inline-flex items-center font-mono-code font-medium border rounded transition-colors ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="hover:opacity-75 focus:outline-none ml-0.5"
          aria-label="Remove tag"
        >
          ×
        </button>
      )}
    </span>
  )
}
