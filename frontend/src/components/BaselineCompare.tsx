import React from 'react'
import type { CompareResult } from '../api/types'
import { Card } from './ui'

export interface BaselineCompareProps {
  compare?: CompareResult | null
}

export const BaselineCompare: React.FC<BaselineCompareProps> = ({ compare }) => {
  if (!compare) return null

  return (
    <Card
      title="Remediation approach comparison"
      subtitle="Correlated graph planning versus independent per-account checklists"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Naive Baseline */}
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/20 space-y-2">
          <h4 className="text-xs font-medium text-zinc-300">
            Independent per-account checklist
          </h4>
          <p className="text-xs text-zinc-500">
            Evaluates accounts in isolation, prioritizing items with simple password reuse.
          </p>
          <div className="space-y-1.5 pt-2 text-xs text-zinc-400">
            {compare.baseline_top3.map((f, i) => (
              <div key={i}>
                {i + 1}. {f.title}
              </div>
            ))}
          </div>
          <div className="pt-2 text-xs text-zinc-300 border-t border-zinc-800/80">
            Projected score: <span className="font-semibold text-zinc-100">{compare.baseline_score_after}</span>
          </div>
        </div>

        {/* Chokepoint Correlated */}
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-2">
          <h4 className="text-xs font-medium text-zinc-100">
            Correlated attack graph planner
          </h4>
          <p className="text-xs text-zinc-400">
            Identifies central root recovery hubs and targets cascading chokepoints.
          </p>
          <div className="space-y-1.5 pt-2 text-xs text-zinc-300">
            {compare.chokepoint_top3.map((f, i) => (
              <div key={i} className="font-medium text-zinc-200">
                {i + 1}. {f.title}
              </div>
            ))}
          </div>
          <div className="pt-2 text-xs text-zinc-300 border-t border-zinc-800/80 flex items-center justify-between">
            <span>
              Projected score: <span className="font-semibold text-zinc-100">{compare.chokepoint_score_after}</span>
            </span>
            <span className="text-emerald-400 text-xs font-medium">
              +{compare.chokepoint_score_after - compare.baseline_score_after} pts over baseline
            </span>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 mt-3 pt-2 border-t border-zinc-800">
        Both models evaluated under identical simulation worlds.
      </p>
    </Card>
  )
}
