import React, { useState } from 'react'
import { useReview, useCompleteReview, useApplyFix, usePreview, useSelection } from '../api/hooks'
import { Drawer, Button, Chip, Skeleton, useToast } from './ui'
import {
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  Check,
  Info,
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
      showToast('Remediation Applied', `Fix '${fixId}' committed successfully. Score updated.`, 'success')
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
        'Review Completed',
        `Privacy & hygiene audit verified as of ${asOfStr}. Next review in 30 days.`,
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
      title="Security & Hygiene Alerts"
      subtitle="Continuous audit telemetry: weak 2FA, credential reuse, stale backup routes & review schedule"
      width="lg"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setAsOfOffsetDays((prev) => prev + 30)
              }}
              icon={<Clock className="w-3.5 h-3.5 text-cyan-400" />}
              title="Fast-forward evaluation timestamp to simulate 30-day review cadence"
            >
              +30 Days Simulation
            </Button>
            {asOfOffsetDays > 0 && (
              <>
                <span className="text-[11px] font-mono-code text-cyan-400">
                  (as of {asOfStr})
                </span>
                <button
                  onClick={() => setAsOfOffsetDays(0)}
                  className="text-[11px] text-slate-400 hover:text-red-300 underline font-mono-code cursor-pointer"
                  title="Reset date to today"
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
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />}
            >
              Run Review
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={completeReviewMutation.isPending}
              onClick={handleCompleteReview}
              icon={<CheckCircle className="w-4 h-4" />}
            >
              Mark Reviewed
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Controls Summary Banner */}
        <div className="flex items-center justify-between bg-[#101728] border border-[#1e2a42] p-3.5 rounded-lg shadow-sm">
          <div className="flex items-center gap-3 text-xs font-mono-code">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">ACTIVE FINDINGS:</span>
              <span className="font-bold text-slate-100">{items.length}</span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="text-red-400 font-bold">{highSev.length} High</span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400 font-bold">{medSev.length} Med</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 font-bold">{lowSev.length} Info</span>
          </div>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => refetch()}
            loading={isRefetching}
            className="text-cyan-400 hover:text-cyan-300 font-mono-code text-xs"
          >
            Run Review Now
          </Button>
        </div>

        {/* Content Items */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-[#1c2638] rounded-lg bg-[#0a0f1d]/50">
            <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-90" />
            <h4 className="text-sm font-bold text-slate-100 font-mono-code">
              Zero Unresolved Hygiene Violations
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              All credentials, multi-factor gates, and recovery endpoints are verified healthy under the current threat model.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* High Severity Group */}
            {highSev.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono-code font-bold uppercase tracking-wider text-red-400 pb-1 border-b border-red-950">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>High Severity ({highSev.length})</span>
                </div>

                <div className="space-y-2.5">
                  {highSev.map((item) => {
                    const isApplied = item.fix_id ? appliedFixIds.has(item.fix_id) : false
                    const isPreviewOpen = previewData?.fixId === item.fix_id

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isApplied
                            ? 'bg-[#0d1627]/50 border-emerald-900/60 opacity-75'
                            : 'bg-red-950/20 border-red-900/50 hover:border-red-800/80 shadow-sm'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Chip variant={isApplied ? 'success' : 'danger'} size="xs">
                                {isApplied ? 'REMEDIATED' : item.kind.replace(/_/g, ' ').toUpperCase()}
                              </Chip>
                              <span className="text-xs font-bold text-slate-100 font-mono-code">
                                {item.title}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-sans mt-1">
                              {item.detail}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          {item.fix_id && (
                            <div className="flex items-center gap-2 self-end sm:self-start">
                              <Button
                                variant="ghost"
                                size="xs"
                                loading={previewMutation.isPending && previewingFixId === item.fix_id}
                                onClick={() => handlePreview(item.fix_id!)}
                                className="text-slate-400 hover:text-cyan-300 font-mono-code text-[11px]"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                {isPreviewOpen ? 'Hide' : 'Preview'}
                              </Button>
                              <Button
                                variant={isApplied ? 'secondary' : 'danger'}
                                size="xs"
                                disabled={isApplied}
                                loading={applyFixMutation.isPending}
                                onClick={() => handleFix(item.fix_id)}
                                icon={isApplied ? <Check className="w-3 h-3" /> : undefined}
                              >
                                {isApplied ? 'Fixed' : 'Fix'}
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Inline Preview Drawer if toggled */}
                        {isPreviewOpen && previewData && (
                          <div className="mt-3 p-2.5 bg-[#090d18] border border-cyan-900/60 rounded text-xs font-mono-code flex items-center justify-between">
                            <span className="text-slate-300">
                              Estimated Score Impact: {previewData.before} →{' '}
                              <strong className="text-emerald-400">{previewData.after}</strong>
                            </span>
                            <span className="text-cyan-400">
                              ΔEL: {previewData.dEl >= 0 ? `+${previewData.dEl}` : previewData.dEl}
                            </span>
                          </div>
                        )}

                        {/* Target Account Link */}
                        {item.target && item.target !== 'system' && (
                          <div className="mt-3 pt-2 border-t border-red-950/60 flex items-center justify-between text-[11px] font-mono-code">
                            <span className="text-slate-400">Target Node: {item.target}</span>
                            <button
                              onClick={() => {
                                openAccountDetail(item.target)
                                onClose()
                              }}
                              className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-semibold cursor-pointer"
                            >
                              View Account <ArrowRight className="w-3 h-3" />
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
                <div className="flex items-center gap-2 text-xs font-mono-code font-bold uppercase tracking-wider text-amber-400 pb-1 border-b border-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Medium Severity ({medSev.length})</span>
                </div>

                <div className="space-y-2.5">
                  {medSev.map((item) => {
                    const isApplied = item.fix_id ? appliedFixIds.has(item.fix_id) : false
                    const isPreviewOpen = previewData?.fixId === item.fix_id

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isApplied
                            ? 'bg-[#0d1627]/50 border-emerald-900/60 opacity-75'
                            : 'bg-amber-950/20 border-amber-900/50 hover:border-amber-800/80 shadow-sm'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Chip variant={isApplied ? 'success' : 'warning'} size="xs">
                                {isApplied ? 'REMEDIATED' : item.kind.replace(/_/g, ' ').toUpperCase()}
                              </Chip>
                              <span className="text-xs font-bold text-slate-100 font-mono-code">
                                {item.title}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-sans mt-1">
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
                                className="text-slate-400 hover:text-cyan-300 font-mono-code text-[11px]"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                {isPreviewOpen ? 'Hide' : 'Preview'}
                              </Button>
                              <Button
                                variant={isApplied ? 'secondary' : 'secondary'}
                                size="xs"
                                disabled={isApplied}
                                loading={applyFixMutation.isPending}
                                onClick={() => handleFix(item.fix_id)}
                                icon={isApplied ? <Check className="w-3 h-3" /> : undefined}
                              >
                                {isApplied ? 'Fixed' : 'Fix'}
                              </Button>
                            </div>
                          )}
                        </div>

                        {isPreviewOpen && previewData && (
                          <div className="mt-3 p-2.5 bg-[#090d18] border border-cyan-900/60 rounded text-xs font-mono-code flex items-center justify-between">
                            <span className="text-slate-300">
                              Estimated Score Impact: {previewData.before} →{' '}
                              <strong className="text-emerald-400">{previewData.after}</strong>
                            </span>
                            <span className="text-cyan-400">
                              ΔEL: {previewData.dEl >= 0 ? `+${previewData.dEl}` : previewData.dEl}
                            </span>
                          </div>
                        )}

                        {item.target && item.target !== 'system' && (
                          <div className="mt-3 pt-2 border-t border-amber-950/60 flex items-center justify-between text-[11px] font-mono-code">
                            <span className="text-slate-400">Target Node: {item.target}</span>
                            <button
                              onClick={() => {
                                openAccountDetail(item.target)
                                onClose()
                              }}
                              className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-semibold cursor-pointer"
                            >
                              View Account <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Low Severity / Maintenance Group */}
            {lowSev.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono-code font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-[#1e2a42]">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Scheduled Maintenance & Audit ({lowSev.length})</span>
                </div>

                <div className="space-y-2.5">
                  {lowSev.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-[#0d1424] border border-[#1e2a42] rounded-lg shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Chip variant="default" size="xs">
                              {item.kind.replace(/_/g, ' ').toUpperCase()}
                            </Chip>
                            <span className="text-xs font-bold text-slate-200 font-mono-code">
                              {item.title}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.detail}</p>
                        </div>

                        {item.kind === 'periodic_review' && (
                          <Button
                            variant="secondary"
                            size="xs"
                            loading={completeReviewMutation.isPending}
                            onClick={handleCompleteReview}
                            className="font-mono-code text-[11px]"
                          >
                            Mark Reviewed
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mandatory PRD Disclaimer */}
        <div className="pt-4 border-t border-[#1c2638] flex items-center gap-2 text-[11px] text-slate-500 font-mono-code">
          <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span>
            Model-based estimate, not a measured probability. Data stays on this device.
          </span>
        </div>
      </div>
    </Drawer>
  )
}
