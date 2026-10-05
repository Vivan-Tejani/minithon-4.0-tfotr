import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'destructive' | 'ghost' | 'outline' | 'default'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  icon?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary:
      'bg-zinc-50 text-zinc-900 hover:bg-zinc-200 font-medium border border-zinc-200/20',
    default:
      'bg-zinc-50 text-zinc-900 hover:bg-zinc-200 font-medium border border-zinc-200/20',
    secondary:
      'bg-zinc-800 text-zinc-100 hover:bg-zinc-700/80 border border-zinc-700/40',
    danger:
      'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
    destructive:
      'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
    ghost:
      'bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-transparent',
    outline:
      'bg-transparent hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:text-zinc-100',
  }[variant]

  const sizeStyles = {
    xs: 'px-2 py-1 text-xs gap-1.5 rounded-md',
    sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg',
    md: 'px-3.5 py-2 text-sm gap-2 rounded-lg',
    lg: 'px-5 py-2.5 text-base gap-2.5 rounded-lg',
    icon: 'p-2 w-9 h-9 rounded-lg',
  }[size]

  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${variantStyles} ${sizeStyles} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-3.5 w-3.5 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
