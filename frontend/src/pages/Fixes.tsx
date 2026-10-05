import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFixes, useApplyFix, useSeedDemo } from '../api/hooks'
import { FixCard } from '../components/FixCard'
import { PreviewCard } from '../components/PreviewCard'
import { Skeleton, Button, Card } from '../components/ui'
import { AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react'

export const Fixes: React.FC = () => {
  useEffect(() => {
    document.title = 'Fix checklist · Chokepoint'
  }, [])

  const { data: fixes, isLoading, isError, refetch } = useFixes()
  const applyFixMutation = useApplyFix()
  const seedMutation = useSeedDemo()

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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-50">
            Fix checklist
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Prioritized security mitigations calculated across attack trajectories.
          </p>
        </div>

        {plan.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Load demo persona
          </Button>
        )}
      </div>

      {/* Error Banner with Retry */}
      {isError && (
        <Card className="border-red-500/20 bg-red-500/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">Failed to calculate remediation plan</p>
                <p className="text-xs text-zinc-400">Could not retrieve fixes from backend optimization engine.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Projected Score Impact Card */}
      {plan.length > 0 && (
        <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-zinc-100">
              Correlated remediation plan
            </h3>
            <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
              Fixes are re-evaluated marginal to previous recommendations. Resolving the top 3 items addresses common root recovery vectors.
            </p>
          </div>

          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-right flex-shrink-0">
            <div className="text-xs text-zinc-400">Projected score</div>
            <div className="text-lg font-semibold flex items-center gap-2 justify-end mt-0.5 font-mono-code tabular-nums">
              <span className="text-zinc-400">{baseScore}</span>
              <span className="text-zinc-600 text-xs font-sans">→</span>
              <span className="text-zinc-100">{maxProjected}</span>
              <span className="text-xs font-normal text-emerald-400">
                (+{maxProjected - baseScore} pts)
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Empty State when 0 fixes */}
      {!isLoading && !isError && plan.length === 0 && (
        <Card>
          <div className="py-12 px-4 text-center max-w-md mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-400/80 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-zinc-100">
              No pending remediations
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Either all registered services are already hardened, or no accounts have been added yet.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <Button
                size="sm"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Load demo persona
              </Button>
              <Link to="/accounts">
                <Button variant="outline" size="sm">
                  Go to accounts
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Filter and Toggles Bar */}
      {plan.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => setQuickWinsOnly(false)}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                !quickWinsOnly
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All recommendations ({plan.length})
            </button>
            <button
              onClick={() => setQuickWinsOnly(true)}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                quickWinsOnly
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Quick wins only
            </button>
          </div>

          <span className="text-zinc-500 hidden sm:inline text-xs">
            {appliedFixes.size} remediations applied this session
          </span>
        </div>
      )}

      {/* Live Ghost Preview Panel (if a fix preview is selected) */}
      {previewFixId && (
        <div className="relative">
          <button
            onClick={() => setPreviewFixId(null)}
            className="absolute top-3 right-3 z-10 text-xs text-zinc-400 hover:text-zinc-100 cursor-pointer"
          >
            Close preview ✕
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
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : quickWinsOnly && displayedPlan.length === 0 && plan.length > 0 ? (
        <Card className="py-8 text-center text-xs text-zinc-400">
          <p>No low-effort recommendations remaining.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickWinsOnly(false)}
            className="mt-3"
          >
            Show all {plan.length} recommendations
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
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
