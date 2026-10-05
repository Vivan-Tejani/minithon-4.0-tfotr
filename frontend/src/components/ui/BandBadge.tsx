import React, { useState } from 'react'
import type { RiskBand } from '../../api/types'

export interface BandBadgeProps {
  band: RiskBand
  probability?: number | null
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export const BandBadge: React.FC<BandBadgeProps> = ({
  band,
  probability,
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false)

  const config = {
    high: {
      label: 'High risk',
      pill: 'bg-red-500/10 text-red-400 border-red-500/20',
      dot: 'bg-red-500',
    },
    medium: {
      label: 'Medium risk',
      pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      dot: 'bg-amber-500',
    },
    low: {
      label: 'Low risk',
      pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-500',
    },
  }[band]

  const pct =
    typeof probability === 'number'
      ? `${Math.round(probability * 100)}%`
      : band === 'high'
      ? '≥40%'
      : band === 'medium'
      ? '15–39%'
      : '<15%'

  const sizeStyles = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs'

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center gap-1.5 font-medium border rounded-full transition-colors ${config.pill} ${sizeStyles} ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {showLabel && <span>{config.label}</span>}
        {probability !== undefined && probability !== null && (
          <span className="font-mono-code tabular-nums text-[11px] opacity-80">({pct})</span>
        )}
      </span>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg text-left pointer-events-none text-xs">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-1.5">
            <span className="text-zinc-400">Likelihood</span>
            <span className="text-zinc-100 font-semibold font-mono-code">{pct}</span>
          </div>
          <div className="text-zinc-300">
            Classification: <span className="font-medium text-zinc-100">{config.label}</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 border-t border-zinc-800 pt-1">
            Model-based estimate, not a measured probability.
          </div>
        </div>
      )}
    </div>
  )
}
