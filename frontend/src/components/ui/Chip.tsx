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
    default: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
    accent: 'bg-zinc-800 text-zinc-200 border-zinc-700',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    outline: 'bg-transparent text-zinc-300 border-zinc-800',
    ghost: 'bg-transparent text-zinc-400 border-transparent hover:text-zinc-200',
  }[variant]

  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[10px] gap-1',
    sm: 'px-2.5 py-0.5 text-xs gap-1.5',
    md: 'px-3 py-1 text-xs gap-2',
  }[size]

  return (
    <span
      className={`inline-flex items-center font-normal rounded-full border transition-colors ${variantStyles} ${sizeStyles} ${className}`}
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
