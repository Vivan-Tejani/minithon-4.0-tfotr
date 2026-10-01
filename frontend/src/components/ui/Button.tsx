import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
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
      'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-sm hover:shadow-[0_0_12px_rgba(6,182,212,0.4)] border border-cyan-400',
    secondary:
      'bg-[#131b2e] hover:bg-[#1a253f] text-slate-200 border border-[#222e47] hover:border-[#334466]',
    danger:
      'bg-red-950/70 hover:bg-red-900/80 text-red-200 border border-red-800/80 hover:border-red-700',
    ghost:
      'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-slate-100 border border-transparent',
    outline:
      'bg-transparent hover:bg-slate-800/40 text-cyan-400 border border-cyan-500/50 hover:border-cyan-400',
  }[variant]

  const sizeStyles = {
    xs: 'px-2 py-1 text-xs gap-1.5 rounded',
    sm: 'px-2.5 py-1.5 text-xs gap-2 rounded-md',
    md: 'px-3.5 py-2 text-sm gap-2 rounded-md',
    lg: 'px-5 py-2.5 text-base gap-2.5 rounded-lg',
  }[size]

  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${variantStyles} ${sizeStyles} ${className}`}
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
