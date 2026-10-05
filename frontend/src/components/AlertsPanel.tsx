import React, { useState } from 'react'
import { useReview, useCompleteReview, useApplyFix, usePreview, useSelection } from '../api/hooks'
import { Drawer, Button, useToast } from './ui'
import {
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  Check,
} from 'lucide-react'

export interface AlertsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ isOpen, onClose }) => {
  const [asOfOffsetDays, setAsOfOffsetDays] = useState(0)
  const [previewingFixId, setPreviewingFixId] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<{
    fixId: string
    before: number
    after: number
    dEl: number
  } | null>(null)
  const [appliedFixIds, setAppliedFixIds] = useState<Set<string>>(new Set())

  const { openAccountDetail } = useSelection()
  const { showToast } = useToast()

  const asOfDate = new Date()
  if (asOfOffsetDays > 0) {
    asOfDate.setDate(asOfDate.getDate() + asOfOffsetDays)
  }
  const asOfStr = asOfDate.toISOString().split('T')[0]

  const { data: reviewData, isLoading, isRefetching, refetch } = useReview(
    asOfOffsetDays > 0 ? asOfStr : undefined
  )
  const completeReviewMutation = useCompleteReview()
  const applyFixMutation = useApplyFix()
  const previewMutation = usePreview()

  const items = reviewData?.items ?? []
  const highSev = items.filter((i) => i.severity === 'high')
  const medSev = items.filter((i) => i.severity === 'medium')
  const lowSev = items.filter((i) => i.severity === 'low')

  const handleFix = async (fixId: string | null) => {
    if (!fixId) return
    try {
      await applyFixMutation.mutateAsync(fixId)
      setAppliedFixIds((prev) => new Set(prev).add(fixId))
      showToast('Remediation applied', `Fix '${fixId}' committed successfully.`, 'success')
      refetch()
    } catch {
      // Handled globally
    }
  }

  const handlePreview = async (fixId: string) => {
    if (previewingFixId === fixId) {
      setPreviewingFixId(null)
      setPreviewData(null)
      return
    }

    setPreviewingFixId(fixId)
    try {
      const res = await previewMutation.mutateAsync({
        op: 'apply_fix',
        fix_id: fixId,
      })
      setPreviewData({
        fixId,
        before: res.score_before,
        after: res.score_after,
        dEl: res.d_el,
      })
    } catch {
      setPreviewingFixId(null)
      setPreviewData(null)
    }
  }

  const handleCompleteReview = async () => {
    try {
      await completeReviewMutation.mutateAsync()
      showToast(
        'Review completed',
        `Privacy & hygiene audit verified as of ${asOfStr}. Next review scheduled in 30 days.`,
        'success'
      )
      refetch()
      onClose()
    } catch {
      // Handled globally
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Security & hygiene review"
      subtitle="Weak second-factor configurations, password reuse, and review schedule"
      width="lg"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full text-xs">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setAsOfOffsetDays((prev) => prev + 30)
              }}
            >
              +30 days simulation
            </Button>
            {asOfOffsetDays > 0 && (
              <>
                <span className="text-zinc-400 font-mono-code">
                  ({asOfStr})
                </span>
                <button
                  onClick={() => setAsOfOffsetDays(0)}
                  className="text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                >
                  Reset
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => refetch()}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
              Recheck
            </Button>
            <Button
              size="sm"
              loading={completeReviewMutation.isPending}
              onClick={handleCompleteReview}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              Complete review
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-xs">
        {/* Summary header */}
        <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">Active findings:</span>
            <span className="font-semibold text-zinc-100">{items.length}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-red-400">{highSev.length} high</span>
            <span className="text-zinc-600">·</span>
            <span className="text-amber-400">{medSev.length} medium</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{lowSev.length} info</span>
          </div>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => refetch()}
            loading={isRefetching}
            className="text-zinc-400 hover:text-zinc-100"
          >
            Run check now
          </Button>
        </div>

        {/* Content Items */}
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-20 bg-zinc-900 rounded-xl animate-pulse" />
            <div className="h-20 bg-zinc-900 rounded-xl animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 border border-zinc-800 rounded-xl bg-zinc-900/30">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <h4 className="text-sm font-medium text-zinc-100">
              Zero unresolved violations
            </h4>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
              All credentials, multi-factor gates, and recovery endpoints are verified healthy under the current threat model.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* High Severity Group */}
            {highSev.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-red-400 pb-1 border-b border-zinc-800">
                  <ShieldAlert className="w-4 h-4" />
                  <span>High severity ({highSev.length})</span>
                </div>

                <div className="space-y-2.5">
                  {highSev.map((item) => {
                    const isApplied = item.fix_id ? appliedFixIds.has(item.fix_id) : false
                    const isPreviewOpen = previewData?.fixId === item.fix_id

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-colors ${
                          isApplied
                            ? 'bg-zinc-900/30 border-zinc-800/80 opacity-75'
                            : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                  isApplied
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}
                              >
                                {isApplied ? 'Remediated' : 'High'}
                              </span>
                              <span className="text-xs font-medium text-zinc-100">
                                {item.title}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                              {item.detail}
                            </p>
                          </div>

                          {item.fix_id && (
                            <div className="flex items-center gap-2 self-end sm:self-start">
                              <Button
                                variant="ghost"
                                size="xs"
                                loading={previewMutation.isPending && previewingFixId === item.fix_id}
                                onClick={() => handlePreview(item.fix_id!)}
                                className="text-zinc-400 hover:text-zinc-100"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                {isPreviewOpen ? 'Hide' : 'Preview'}
                              </Button>
                              <Button
                                variant={isApplied ? 'secondary' : 'default'}
                                size="xs"
                                disabled={isApplied}
                                loading={applyFixMutation.isPending}
                                onClick={() => handleFix(item.fix_id)}
                              >
                                {isApplied ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1" />
                                    Fixed
                                  </>
                                ) : (
                                  'Fix'
                                )}
                              </Button>
                            </div>
                          )}
                        </div>

                        {isPreviewOpen && previewData && (
                          <div className="mt-3 p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs flex items-center justify-between">
                            <span className="text-zinc-300">
                              Estimated score impact: {previewData.before} →{' '}
                              <strong className="text-emerald-400 font-mono-code">{previewData.after}</strong>
                            </span>
                            <span className="text-zinc-400 font-mono-code">
                              ΔEL: {previewData.dEl >= 0 ? `+${previewData.dEl}` : previewData.dEl}
                            </span>
                          </div>
                        )}

                        {item.target && item.target !== 'system' && (
                          <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                            <span>Target: {item.target}</span>
                            <button
                              onClick={() => {
                                openAccountDetail(item.target)
                                onClose()
                              }}
                              className="text-zinc-200 hover:text-zinc-50 inline-flex items-center gap-1 font-medium cursor-pointer"
                            >
                              View account <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Medium Severity Group */}
            {medSev.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-400 pb-1 border-b border-zinc-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Medium severity ({medSev.length})</span>
                </div>

                <div className="space-y-2.5">
                  {medSev.map((item) => {
                    const isApplied = item.fix_id ? appliedFixIds.has(item.fix_id) : false
                    const isPreviewOpen = previewData?.fixId === item.fix_id

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-colors ${
                          isApplied
                            ? 'bg-zinc-900/30 border-zinc-800/80 opacity-75'
                            : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                  isApplied
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}
                              >
                                {isApplied ? 'Remediated' : 'Medium'}
                              </span>
                              <span className="text-xs font-medium text-zinc-100">
                                {item.title}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                              {item.detail}
                            </p>
                          </div>

                          {item.fix_id && (
                            <div className="flex items-center gap-2 self-end sm:self-start">
                              <Button
                                variant="ghost"
                                size="xs"
                                loading={previewMutation.isPending && previewingFixId === item.fix_id}
                                onClick={() => handlePreview(item.fix_id!)}
                                className="text-zinc-400 hover:text-zinc-100"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                {isPreviewOpen ? 'Hide' : 'Preview'}
                              </Button>
                              <Button
                                variant={isApplied ? 'secondary' : 'default'}
                                size="xs"
                                disabled={isApplied}
                                loading={applyFixMutation.isPending}
                                onClick={() => handleFix(item.fix_id)}
                              >
                                {isApplied ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1" />
                                    Fixed
                                  </>
                                ) : (
                                  'Fix'
                                )}
                              </Button>
                            </div>
                          )}
                        </div>

                        {isPreviewOpen && previewData && (
                          <div className="mt-3 p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs flex items-center justify-between">
                            <span className="text-zinc-300">
                              Estimated score impact: {previewData.before} →{' '}
                              <strong className="text-emerald-400 font-mono-code">{previewData.after}</strong>
                            </span>
                            <span className="text-zinc-400 font-mono-code">
                              ΔEL: {previewData.dEl >= 0 ? `+${previewData.dEl}` : previewData.dEl}
                            </span>
                          </div>
                        )}

                        {item.target && item.target !== 'system' && (
                          <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                            <span>Target: {item.target}</span>
                            <button
                              onClick={() => {
                                openAccountDetail(item.target)
                                onClose()
                              }}
                              className="text-zinc-200 hover:text-zinc-50 inline-flex items-center gap-1 font-medium cursor-pointer"
                            >
                              View account <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}
