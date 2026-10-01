import React, { useState } from 'react'
import { useReview, useCompleteReview, useApplyFix, useSelection } from '../api/hooks'
import { Drawer, Button, Chip, Skeleton } from './ui'
import { AlertTriangle, CheckCircle, ShieldAlert, Clock, ArrowRight } from 'lucide-react'

export interface AlertsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ isOpen, onClose }) => {
  const [asOfOffsetDays, setAsOfOffsetDays] = useState(0)
  const { openAccountDetail } = useSelection()

  const asOfDate = new Date()
  if (asOfOffsetDays > 0) {
    asOfDate.setDate(asOfDate.getDate() + asOfOffsetDays)
  }
  const asOfStr = asOfDate.toISOString().split('T')[0]

  const { data: reviewData, isLoading, refetch } = useReview(asOfOffsetDays > 0 ? asOfStr : undefined)
  const completeReviewMutation = useCompleteReview()
  const applyFixMutation = useApplyFix()

  const items = reviewData?.items ?? []
  const highSev = items.filter((i) => i.severity === 'high')
  const medSev = items.filter((i) => i.severity === 'medium')
  const lowSev = items.filter((i) => i.severity === 'low')

  const handleFix = async (fixId: string | null) => {
    if (!fixId) return
    await applyFixMutation.mutateAsync(fixId)
    refetch()
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Security & Review Alerts"
      subtitle="Periodic hygiene audits, weak recovery gates & breach reminders"
      width="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setAsOfOffsetDays((prev) => prev + 30)
              }}
              icon={<Clock className="w-3.5 h-3.5 text-cyan-400" />}
            >
              +30 Days Simulation
            </Button>
            {asOfOffsetDays > 0 && (
              <span className="text-[11px] font-mono-code text-cyan-400">
                (as of {asOfStr})
              </span>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={completeReviewMutation.isPending}
            onClick={async () => {
              await completeReviewMutation.mutateAsync()
              onClose()
            }}
            icon={<CheckCircle className="w-4 h-4" />}
          >
            Mark Reviewed
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Controls Bar */}
        <div className="flex items-center justify-between bg-[#111728] border border-[#1e2a42] p-3 rounded-lg">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Active alerts:</span>
            <span className="font-mono-code font-bold text-slate-100">{items.length}</span>
            <span className="text-slate-500">|</span>
            <span className="text-red-400">{highSev.length} critical</span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => refetch()}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Run Review Now
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#1c2638] rounded-lg">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-medium text-slate-200">All Security Reviews Current</p>
            <p className="text-xs text-slate-400 mt-1">
              No stale credentials or critical recovery weaknesses detected.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* High Severity */}
            {highSev.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                  <ShieldAlert className="w-4 h-4" />
                  <span>High Severity ({highSev.length})</span>
                </div>
                {highSev.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-red-950/20 border border-red-900/40 rounded-lg hover:border-red-800/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Chip variant="danger" size="xs">
                            {item.kind.replace('_', ' ')}
                          </Chip>
                          <span className="text-xs font-semibold text-slate-100">{item.title}</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{item.detail}</p>
                      </div>
                      {item.fix_id && (
                        <Button
                          variant="danger"
                          size="xs"
                          loading={applyFixMutation.isPending}
                          onClick={() => handleFix(item.fix_id)}
                        >
                          Fix
                        </Button>
                      )}
                    </div>
                    {item.target && item.target !== 'system' && (
                      <div className="mt-2.5 pt-2 border-t border-red-950/60 flex items-center justify-between text-[11px]">
                        <span className="font-mono-code text-slate-400">Target: {item.target}</span>
                        <button
                          onClick={() => {
                            openAccountDetail(item.target)
                            onClose()
                          }}
                          className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-medium"
                        >
                          View Account <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Medium Severity */}
            {medSev.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Medium Severity ({medSev.length})</span>
                </div>
                {medSev.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-amber-950/20 border border-amber-900/40 rounded-lg hover:border-amber-800/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Chip variant="warning" size="xs">
                            {item.kind.replace('_', ' ')}
                          </Chip>
                          <span className="text-xs font-semibold text-slate-100">{item.title}</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{item.detail}</p>
                      </div>
                      {item.fix_id && (
                        <Button
                          variant="secondary"
                          size="xs"
                          loading={applyFixMutation.isPending}
                          onClick={() => handleFix(item.fix_id)}
                        >
                          Fix
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Low Severity */}
            {lowSev.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span>Low Severity / Maintenance ({lowSev.length})</span>
                </div>
                {lowSev.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-[#101726] border border-[#1e2a42] rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Chip variant="default" size="xs">
                        {item.kind.replace('_', ' ')}
                      </Chip>
                      <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}
