import React, { useState } from 'react'
import { useFixes, useApplyFix } from '../api/hooks'
import { FixCard } from '../components/FixCard'
import { PreviewCard } from '../components/PreviewCard'
import { Skeleton } from '../components/ui'
import { Zap } from 'lucide-react'

export const Fixes: React.FC = () => {
  const { data: fixes, isLoading } = useFixes()
  const applyFixMutation = useApplyFix()

  const [previewFixId, setPreviewFixId] = useState<string | null>(null)
  const [quickWinsOnly, setQuickWinsOnly] = useState(false)
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set())

  const plan = fixes?.plan ?? []
  const baseScore = fixes?.base_score ?? 41

  const best3Items = plan.filter((f) => f.in_best3)
  const maxProjected =
    best3Items.length > 0 ? best3Items[best3Items.length - 1].score_after : baseScore

  const displayedPlan = quickWinsOnly
    ? plan.filter((f) => f.effort === 'low')
    : plan

  const handleApply = async (fixId: string) => {
    await applyFixMutation.mutateAsync(fixId)
    setAppliedFixes((prev) => new Set([...prev, fixId]))
  }

  return (
    <div className="space-y-6">
      {/* Best-3 Plan Header Card */}
      <div className="bg-gradient-to-r from-[#0b192e] via-[#0f213d] to-[#0c182b] border border-cyan-500/40 rounded-lg p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-code font-bold uppercase tracking-wider text-cyan-300">
                Counterfactual Takeover Planner (CTP)
              </span>
              <span className="text-[10px] font-mono-code bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-700 text-cyan-300">
                GREEDY CELF RANKED
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 font-mono-code">
              High-Impact Remediation Checklist
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Fixes are re-evaluated marginal to previous recommendations inside identical attack worlds.
              Redundant mitigations naturally decrease in rank.
            </p>
          </div>

          <div className="p-3 bg-[#070b14] border border-[#1c2638] rounded-lg text-right font-mono-code flex-shrink-0">
            <div className="text-[11px] text-slate-400">Current → Projected Posture</div>
            <div className="text-xl font-bold flex items-center gap-2 justify-end mt-0.5">
              <span className="text-amber-400">{baseScore}</span>
              <span className="text-slate-500 text-sm">→</span>
              <span className="text-emerald-400">{maxProjected}</span>
              <span className="text-xs font-normal text-emerald-400">
                (+{maxProjected - baseScore} pts)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Toggles Bar */}
      <div className="flex items-center justify-between bg-[#0d131f] border border-[#1c2638] p-3 rounded-lg text-xs font-mono-code">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuickWinsOnly(false)}
            className={`px-3 py-1.5 rounded transition-colors ${
              !quickWinsOnly
                ? 'bg-[#152037] text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Recommendations ({plan.length})
          </button>
          <button
            onClick={() => setQuickWinsOnly(true)}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              quickWinsOnly
                ? 'bg-[#152037] text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Quick Wins Only (Low Effort)
          </button>
        </div>

        <span className="text-slate-500 hidden sm:inline text-[11px]">
          {appliedFixes.size} remediations applied this session
        </span>
      </div>

      {/* Live Ghost Preview Panel (if a fix preview is selected) */}
      {previewFixId && (
        <div className="relative">
          <button
            onClick={() => setPreviewFixId(null)}
            className="absolute top-2 right-2 z-10 text-xs text-slate-400 hover:text-slate-100 font-mono-code cursor-pointer"
          >
            Close Preview ✕
          </button>
          <PreviewCard
            request={{ op: 'apply_fix', fix_id: previewFixId }}
            currentScore={baseScore}
          />
        </div>
      )}

      {/* Fix Checklist Cards */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayedPlan.map((fix) => (
            <FixCard
              key={fix.id}
              fix={fix}
              onApply={handleApply}
              onPreview={(id) => setPreviewFixId(id)}
              isApplying={applyFixMutation.isPending}
              isApplied={appliedFixes.has(fix.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
