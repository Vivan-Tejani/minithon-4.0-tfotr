import React from 'react'
import type { SpofCandidate } from '../api/types'
import { Card, Chip } from './ui'
import { AlertOctagon, Flame } from 'lucide-react'

export interface SpofPanelProps {
  spofs: SpofCandidate[]
  onSelectCandidate?: (id: string) => void
}

export const SpofPanel: React.FC<SpofPanelProps> = ({ spofs, onSelectCandidate }) => {
  return (
    <Card
      title="Single Points of Failure (SPOFs)"
      subtitle="Critical root vectors that cascade to compromise the most accounts"
      action={<Flame className="w-4 h-4 text-red-400" />}
    >
      <div className="space-y-2.5">
        {spofs.map((spof) => (
          <div
            key={spof.id}
            onClick={() => onSelectCandidate?.(spof.id)}
            className="p-3 bg-[#0a0f1d] hover:bg-[#111728] border border-[#1c2638] hover:border-red-900/60 rounded-lg transition-colors cursor-pointer flex items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded bg-red-950/60 border border-red-800/60 text-red-400 mt-0.5">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-100">{spof.label}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[11px] font-mono-code text-red-400 font-semibold">
                    Takes down {spof.falls} accounts
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-[11px] font-mono-code text-slate-400">
                    ΔEL: +{spof.d_el.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {spof.falls_ids.slice(0, 3).map((fId) => (
                <Chip key={fId} size="xs" variant="outline" className="text-[10px]">
                  {fId}
                </Chip>
              ))}
              {spof.falls_ids.length > 3 && (
                <span className="text-[10px] text-slate-500 font-mono-code">
                  +{spof.falls_ids.length - 3}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
