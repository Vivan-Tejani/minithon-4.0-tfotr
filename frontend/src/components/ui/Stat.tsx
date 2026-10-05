import React from 'react'

export interface StatProps {
  label: string
  value: React.ReactNode
  subtext?: string
  change?: string
  trend?: 'up' | 'down' | 'neutral' | 'danger'
  icon?: React.ReactNode
  className?: string
  onClick?: () => void
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  subtext,
  icon,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col justify-between transition-colors ${
        onClick ? 'cursor-pointer hover:border-zinc-700/80' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-medium text-zinc-400">
          {label}
        </span>
        {icon && <span className="text-zinc-500">{icon}</span>}
      </div>

      <div className="space-y-1">
        <div className="text-3xl font-semibold tracking-tight text-zinc-50 tabular-nums">
          {value}
        </div>
        {subtext && (
          <p className="text-xs text-zinc-400 leading-normal">
            {subtext}
          </p>
        )}
      </div>
    </div>
  )
}
