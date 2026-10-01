import React, { useEffect } from 'react'
import type { PreviewRequest } from '../api/types'
import { usePreview, useGhost } from '../api/hooks'
import { Card, Skeleton } from './ui'
import { Eye, TrendingDown, ArrowRight } from 'lucide-react'

export interface PreviewCardProps {
  request: PreviewRequest | null
  currentScore?: number
}

export const PreviewCard: React.FC<PreviewCardProps> = ({ request, currentScore = 41 }) => {
  const { setGhost } = useGhost()
  const previewMutation = usePreview()

  useEffect(() => {
    if (!request) {
      setGhost(null)
      return
    }

    const timer = setTimeout(() => {
      previewMutation.mutate(request, {
        onSuccess: (data) => {
          setGhost(data.ghost)
        },
      })
    }, 400)

    return () => {
      clearTimeout(timer)
    }
  }, [request])

  useEffect(() => {
    return () => {
      setGhost(null)
    }
  }, [])

  if (!request) return null

  const preview = previewMutation.data
  const isLoading = previewMutation.isPending

  return (
    <Card
      title="Ghost Delta Live Preview"
      subtitle="Evaluates graph impact before persisting changes"
      action={<Eye className="w-4 h-4 text-cyan-400" />}
      variant="alert"
      className="border-dashed border-amber-600/60 bg-amber-950/20"
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6" />
          <Skeleton className="h-4" />
        </div>
      ) : preview ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono-code bg-[#070b14] p-2.5 rounded border border-amber-900/60">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Score Projection:</span>
              <span className="text-slate-200">{preview.score_before || currentScore}</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
              <span
                className={`font-bold ${
                  preview.score_after < currentScore ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {preview.score_after}
              </span>
              <span className="text-slate-400">
                ({preview.score_after - currentScore >= 0 ? '+' : ''}
                {preview.score_after - currentScore} pts)
              </span>
            </div>
            <div className="text-amber-300">
              ΔEL: {preview.d_el >= 0 ? `+${preview.d_el.toFixed(1)}` : preview.d_el.toFixed(1)}
            </div>
          </div>

          {preview.new_paths && preview.new_paths.length > 0 && (
            <div className="text-xs space-y-1">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">
                Top New Attack Vector Introduced:
              </span>
              <p className="text-red-300 font-mono-code text-[11px] bg-red-950/40 p-2 rounded border border-red-900/50">
                {preview.new_paths[0].steps.map((s) => s.node).join(' → ')} via{' '}
                {preview.new_paths[0].steps[0]?.via}
              </p>
            </div>
          )}
        </div>
      ) : previewMutation.isError ? (
        <div className="flex items-center gap-2 text-xs text-amber-400 py-1 font-mono-code">
          <TrendingDown className="w-4 h-4 text-amber-400" />
          <span>Complete required account details to preview impact.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-1 font-mono-code">
          <TrendingDown className="w-4 h-4 text-cyan-400" />
          <span>Awaiting modification debounce to simulate counterfactual worlds...</span>
        </div>
      )}
    </Card>
  )
}
