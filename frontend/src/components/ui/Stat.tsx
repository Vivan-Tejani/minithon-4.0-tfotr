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
  change,
  trend = 'neutral',
  icon,
  className = '',
  onClick,
}) => {
  const trendColor = {
    up: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40',
    down: 'text-cyan-400 bg-cyan-950/60 border-cyan-800/40',
    danger: 'text-red-400 bg-red-950/60 border-red-800/40',
    neutral: 'text-slate-400 bg-slate-800/60 border-slate-700/40',
  }[trend]

  return (
    <div
      onClick={onClick}
      className={`bg-[#0d131f] border border-[#1c2638] rounded-lg p-4 flex flex-col justify-between transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-[#2e3e5c] hover:bg-[#101726]' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
        <span>{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="text-2xl font-bold font-mono-code text-slate-100 tracking-tight">
          {value}
        </span>
        {change && (
          <span
            className={`text-[11px] font-mono-code px-1.5 py-0.5 rounded border ${trendColor}`}
          >
            {change}
          </span>
        )}
      </div>

      {subtext && <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">{subtext}</p>}
    </div>
  )
}
