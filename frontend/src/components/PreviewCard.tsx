import React, { useEffect } from 'react'
import type { PreviewRequest } from '../api/types'
import { usePreview, useGhost } from '../api/hooks'
import { Card, Skeleton } from './ui'
import { ArrowRight } from 'lucide-react'

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
      title="Projected impact preview"
      subtitle="Evaluates security score impact before persisting changes"
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6" />
          <Skeleton className="h-4" />
        </div>
      ) : preview ? (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Score projection:</span>
              <span className="text-zinc-300 font-mono-code">{preview.score_before || currentScore}</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
              <span
                className={`font-semibold font-mono-code ${
                  preview.score_after < currentScore ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {preview.score_after}
              </span>
              <span className="text-zinc-500 font-mono-code">
                ({preview.score_after - currentScore >= 0 ? '+' : ''}
                {preview.score_after - currentScore} pts)
              </span>
            </div>
            <div className="text-zinc-400 font-mono-code">
              ΔEL: {preview.d_el >= 0 ? `+${preview.d_el.toFixed(1)}` : preview.d_el.toFixed(1)}
            </div>
          </div>

          {preview.new_paths && preview.new_paths.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-zinc-400 block">
                New attack vector introduced:
              </span>
              <p className="text-zinc-200 text-xs bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                {preview.new_paths[0].steps.map((s) => s.node).join(' → ')} via{' '}
                {preview.new_paths[0].steps[0]?.via}
              </p>
            </div>
          )}
        </div>
      ) : previewMutation.isError ? (
        <div className="text-xs text-zinc-500 py-1">
          Complete required fields to preview impact.
        </div>
      ) : (
        <div className="text-xs text-zinc-500 py-1">
          Simulating projected attack graph impact...
        </div>
      )}
    </Card>
  )
}
