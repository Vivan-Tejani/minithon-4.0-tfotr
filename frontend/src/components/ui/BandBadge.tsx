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
      label: 'HIGH RISK',
      pill: 'bg-red-950/80 text-red-300 border-red-800/80',
      dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    },
    medium: {
      label: 'MED RISK',
      pill: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
      dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
    },
    low: {
      label: 'LOW RISK',
      pill: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
      dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
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

  const sizeStyles = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center gap-1.5 font-mono-code font-semibold tracking-wider uppercase border rounded transition-colors cursor-help ${config.pill} ${sizeStyles} ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {showLabel && <span>{config.label}</span>}
        {probability !== undefined && probability !== null && (
          <span className="opacity-90 font-mono-code">({pct})</span>
        )}
      </span>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-[#0d131f] border border-[#222e47] rounded shadow-xl text-left pointer-events-none">
          <div className="flex items-center justify-between text-xs font-mono-code border-b border-[#1c2638] pb-1.5 mb-1.5">
            <span className="text-slate-400">Likelihood:</span>
            <span className="text-slate-100 font-bold">{pct}</span>
          </div>
          <div className="text-[11px] text-slate-300 leading-tight">
            Classification: <span className="font-semibold text-slate-100 uppercase">{band} takeover probability</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 border-t border-[#1c2638]/80 pt-1 italic leading-tight">
            Model-based estimate, not a measured probability. Data stays on this device.
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#0d131f]" />
        </div>
      )}
    </div>
  )
}
