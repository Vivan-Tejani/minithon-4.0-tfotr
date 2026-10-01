import React from 'react'
import type { Fix } from '../api/types'
import { Card, Button, Chip } from './ui'
import { Check, ShieldCheck, Zap } from 'lucide-react'

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
      className={`border transition-all duration-150 ${
        fix.in_best3 ? 'border-cyan-700/60 bg-[#0e1627]' : 'border-[#1c2638] bg-[#0d131f]'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side Info */}
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {fix.in_best3 && (
              <Chip variant="accent" size="xs">
                <Zap className="w-3 h-3 inline mr-0.5" /> BEST 3
              </Chip>
            )}
            <Chip
              variant={
                fix.effort === 'low'
                  ? 'success'
                  : fix.effort === 'medium'
                  ? 'warning'
                  : 'danger'
              }
              size="xs"
            >
              Effort: {fix.effort.toUpperCase()}
            </Chip>
            <span className="text-xs font-mono-code text-slate-400">
              Rank #{fix.rank}
            </span>
          </div>

          <h4 className="text-sm font-bold text-slate-100">{fix.title}</h4>
          <p className="text-xs text-slate-400 leading-relaxed">{fix.why}</p>

          {/* Interaction Note */}
          {fix.note && (
            <p className="text-[11px] font-mono-code text-cyan-300/90 bg-cyan-950/40 border border-cyan-800/40 px-2 py-1 rounded inline-block">
              {fix.note}
            </p>
          )}
        </div>

        {/* Right Side Metrics & Action */}
        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-[#1c2638] pt-3 md:pt-0 md:pl-4 justify-between md:justify-end">
          <div className="text-right font-mono-code">
            <div className="text-xs text-slate-400">
              Marginal Gain: <strong className="text-emerald-400">+{fix.marginal_gain.toFixed(1)}</strong>
            </div>
            <div className="text-[11px] text-slate-500">
              Score After: <strong className="text-slate-200">{fix.score_after}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onPreview && (
              <Button
                id={`preview-btn-${fix.id.replace(/:/g, '-')}`}
                variant="ghost"
                size="sm"
                onClick={() => onPreview(fix.id)}
                className="text-xs font-mono-code text-slate-400"
              >
                Preview
              </Button>
            )}
            <Button
              id={`apply-btn-${fix.id.replace(/:/g, '-')}`}
              variant={fix.in_best3 ? 'primary' : 'secondary'}
              size="sm"
              loading={isApplying}
              disabled={isApplied}
              onClick={() => onApply(fix.id)}
              icon={isApplied ? <Check className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            >
              {isApplied ? 'Remediated' : 'Apply Fix'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
