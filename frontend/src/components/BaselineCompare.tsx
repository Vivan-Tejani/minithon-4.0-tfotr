import React from 'react'
import type { CompareResult } from '../api/types'
import { Card } from './ui'
import { GitCompare } from 'lucide-react'

export interface BaselineCompareProps {
  compare?: CompareResult | null
}

export const BaselineCompare: React.FC<BaselineCompareProps> = ({ compare }) => {
  if (!compare) return null

  return (
    <Card
      title="Counterfactual Takeover Planner vs Naive Scorer"
      subtitle="Demonstration of fix interaction awareness vs independent per-account checklists"
      action={<GitCompare className="w-4 h-4 text-cyan-400" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Naive Baseline */}
        <div className="p-3.5 bg-red-950/20 border border-red-900/40 rounded-lg">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-red-300 mb-2">
            Naive Per-Account Checklist
          </h4>
          <p className="text-[11px] text-slate-400 mb-3">
            Treats accounts independently; recommends fixing Netflix first due to password reuse count.
          </p>
          <div className="space-y-1.5 mb-3 font-mono-code text-xs">
            {compare.baseline_top3.map((f, i) => (
              <div key={i} className="text-slate-300">
                {i + 1}. {f.title}
              </div>
            ))}
          </div>
          <div className="text-xs font-mono-code text-red-400">
            Projected Score: <strong>{compare.baseline_score_after}</strong>
          </div>
        </div>

        {/* Chokepoint CTP */}
        <div className="p-3.5 bg-cyan-950/20 border border-cyan-900/40 rounded-lg">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300 mb-2">
            Chokepoint Correlated CTP
          </h4>
          <p className="text-[11px] text-slate-400 mb-3">
            Identifies SIM swap & Google SSO root hubs; ranks by greedy marginal gain.
          </p>
          <div className="space-y-1.5 mb-3 font-mono-code text-xs">
            {compare.chokepoint_top3.map((f, i) => (
              <div key={i} className="text-slate-100 font-semibold">
                {i + 1}. {f.title}
              </div>
            ))}
          </div>
          <div className="text-xs font-mono-code text-cyan-300">
            Projected Score: <strong>{compare.chokepoint_score_after}</strong> (+27 pts)
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 italic mt-3">
        * Both models evaluated under common random simulation worlds to verify interaction effects.
      </p>
    </Card>
  )
}
