import React from 'react'
import type { SpofCandidate } from '../api/types'
import { Card } from './ui'
import { AlertOctagon } from 'lucide-react'

export interface SpofPanelProps {
  spofs: SpofCandidate[]
  onSelectCandidate?: (id: string) => void
}

export const SpofPanel: React.FC<SpofPanelProps> = ({ spofs, onSelectCandidate }) => {
  return (
    <Card
      title="Single points of failure"
      subtitle="Root vectors that cascade to compromise downstream accounts"
    >
      <div className="space-y-2">
        {spofs.map((spof) => (
          <div
            key={spof.id}
            onClick={() => onSelectCandidate?.(spof.id)}
            className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/50 transition-colors cursor-pointer flex items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3 min-w-0">
              <AlertOctagon className="w-4 h-4 text-amber-500/80 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-100 truncate">{spof.label}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                  <span className="text-red-400 font-medium">
                    Takes down {spof.falls} accounts
                  </span>
                  <span>·</span>
                  <span className="font-mono-code text-[11px]">
                    ΔEL: +{spof.d_el.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {spof.falls_ids.slice(0, 3).map((fId) => (
                <span
                  key={fId}
                  className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-mono-code text-zinc-400"
                >
                  {fId}
                </span>
              ))}
              {spof.falls_ids.length > 3 && (
                <span className="text-[11px] text-zinc-500 font-mono-code">
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
