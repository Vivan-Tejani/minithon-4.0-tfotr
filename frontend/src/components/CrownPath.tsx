import React from 'react'
import type { Path } from '../api/types'
import { Card, Button, BandBadge } from './ui'
import { Crown, Key, CornerDownRight } from 'lucide-react'

export interface CrownPathProps {
  crown: {
    target: string
    path: Path
  } | null
  onFixClick?: (fixId: string) => void
  loadingFix?: boolean
}

export const CrownPath: React.FC<CrownPathProps> = ({ crown, onFixClick, loadingFix = false }) => {
  if (!crown) {
    return (
      <Card title="Crown Jewel Protection" subtitle="Target with maximum security impact">
        <p className="text-xs text-slate-400">No crown jewel target currently designated.</p>
      </Card>
    )
  }

  const { target, path } = crown

  return (
    <Card
      title="Crown Jewel Infiltration Path"
      subtitle={`Easiest route an attacker takes to compromise ${target.toUpperCase()}`}
      action={<Crown className="w-4 h-4 text-amber-400" />}
      variant="elevated"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs p-2.5 bg-[#0a0f1d] border border-[#1e2a42] rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Target Asset:</span>
            <span className="font-mono-code font-bold text-slate-100 uppercase">{target}</span>
          </div>
          <BandBadge band={path.band} probability={path.likelihood} size="sm" />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Attack Trajectory:
          </p>
          <div className="space-y-1.5 pl-3 border-l-2 border-amber-500/50">
            {path.steps.map((step, idx) => (
              <div key={idx} className="text-xs flex items-center gap-2">
                <CornerDownRight className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="font-mono-code text-cyan-300 font-semibold">{step.node}</span>
                <span className="text-slate-500 text-[11px]">→</span>
                <span className="text-slate-300 italic text-[11px]">{step.via}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cut Fix */}
        {path.cut_fix_id && (
          <div className="pt-3 border-t border-[#1c2638] flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-mono-code text-slate-400 block">Single Action Cut:</span>
              <span className="text-xs font-mono-code text-cyan-400 font-semibold">{path.cut_fix_id}</span>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={loadingFix}
              onClick={() => onFixClick?.(path.cut_fix_id)}
              icon={<Key className="w-3.5 h-3.5" />}
            >
              Remediate Route
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
