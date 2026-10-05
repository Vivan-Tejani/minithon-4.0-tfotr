import React from 'react'
import type { Fix } from '../api/types'
import { Card, Button } from './ui'
import { Check } from 'lucide-react'

export interface FixCardProps {
  fix: Fix
  onApply: (fixId: string) => void
  onPreview?: (fixId: string) => void
  isApplying?: boolean
  isApplied?: boolean
}

export const FixCard: React.FC<FixCardProps> = ({
  fix,
  onApply,
  onPreview,
  isApplying = false,
  isApplied = false,
}) => {
  return (
    <Card
      id={`fix-card-${fix.id.replace(/:/g, '-')}`}
      className="p-5"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side Info */}
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {fix.in_best3 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700/50 font-medium">
                Top 3 recommendation
              </span>
            )}
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border ${
                fix.effort === 'low'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : fix.effort === 'medium'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              {fix.effort === 'low' ? 'Low effort' : fix.effort === 'medium' ? 'Medium effort' : 'High effort'}
            </span>
            <span className="text-xs text-zinc-500 font-mono-code">
              #{fix.rank}
            </span>
          </div>

          <h4 className="text-sm font-medium text-zinc-100">{fix.title}</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">{fix.why}</p>

          {fix.note && (
            <p className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-md inline-block">
              {fix.note}
            </p>
          )}
        </div>

        {/* Right Side Metrics & Action */}
        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-zinc-800 pt-3 md:pt-0 md:pl-5 justify-between md:justify-end">
          <div className="text-right">
            <div className="text-xs text-zinc-400">
              Gain: <strong className="text-emerald-400 font-mono-code font-normal">+{fix.marginal_gain.toFixed(1)}</strong>
            </div>
            <div className="text-xs text-zinc-500">
              Score after: <strong className="text-zinc-200 font-mono-code font-normal">{fix.score_after}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onPreview && (
              <Button
                id={`preview-btn-${fix.id.replace(/:/g, '-')}`}
                variant="ghost"
                size="sm"
                onClick={() => onPreview(fix.id)}
                className="text-xs text-zinc-400 hover:text-zinc-100"
              >
                Preview
              </Button>
            )}
            <Button
              id={`apply-btn-${fix.id.replace(/:/g, '-')}`}
              variant={fix.in_best3 ? 'default' : 'secondary'}
              size="sm"
              loading={isApplying}
              disabled={isApplied}
              onClick={() => onApply(fix.id)}
            >
              {isApplied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  Applied
                </>
              ) : (
                'Apply fix'
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
