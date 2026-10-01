import React from 'react'
import { useSelection, useAnalysis, useApplyFix } from '../api/hooks'
import { Drawer, BandBadge, Chip, Button } from './ui'
import { Shield, Key, AlertTriangle, CornerDownRight } from 'lucide-react'

export interface AccountDetailProps {
  accountId?: string | null
  isOpen?: boolean
  onClose?: () => void
}

export const AccountDetail: React.FC<AccountDetailProps> = ({
  accountId: propId,
  isOpen: propIsOpen,
  onClose: propOnClose,
}) => {
  const { selectedAccountId, isDetailOpen, closeAccountDetail } = useSelection()
  const { data: analysis } = useAnalysis()
  const applyFixMutation = useApplyFix()

  const currentId = propId !== undefined ? propId : selectedAccountId
  const isOpen = propIsOpen !== undefined ? propIsOpen : isDetailOpen
  const handleClose = propOnClose || closeAccountDetail

  const account = analysis?.accounts.find((a) => a.id === currentId)

  if (!account) {
    return (
      <Drawer isOpen={isOpen} onClose={handleClose} title="Account Details" width="md">
        <p className="text-slate-400">Select an account to view vulnerability telemetry.</p>
      </Drawer>
    )
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={account.name}
      subtitle={`Account Key: ${account.id}`}
      width="md"
    >
      <div className="space-y-6">
        {/* Risk & Impact Header */}
        <div className="flex items-center justify-between p-3.5 bg-[#111728] border border-[#1e2a42] rounded-lg">
          <div className="flex items-center gap-3">
            <BandBadge band={account.band} probability={account.p} size="md" />
            <span className="text-xs text-slate-400 font-mono-code">
              Impact: <strong className="text-slate-100">{account.impact}/10</strong>
            </span>
          </div>
          <span className="text-xs font-mono-code text-cyan-400">
            P = {Math.round(account.p * 100)}%
          </span>
        </div>

        {/* Narrative Explanation */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400" /> Vulnerability Diagnostic
          </h4>
          <p className="text-xs text-slate-200 bg-[#0d1320] border border-[#1c2638] p-3 rounded-lg leading-relaxed font-mono-code">
            {account.why}
          </p>
        </div>

        {/* Contributing Factors */}
        {account.reasons && account.reasons.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Contributing Attack Vectors
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {account.reasons.map((r, i) => (
                <Chip key={i} variant="warning" size="sm">
                  {r}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* Attack Paths */}
        {account.top_paths && account.top_paths.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <CornerDownRight className="w-3.5 h-3.5 text-red-400" /> Top Takeover Paths
            </h4>
            <div className="space-y-3">
              {account.top_paths.map((path, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#0a0f1d] border border-red-950/70 rounded-lg space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono-code font-bold text-red-300">
                      Route #{idx + 1}
                    </span>
                    <span className="font-mono-code text-[11px] text-slate-400">
                      Solo Likelihood: {Math.round(path.likelihood * 100)}%
                    </span>
                  </div>

                  <div className="space-y-1.5 pl-2 border-l border-red-900/50">
                    {path.steps.map((step, sIdx) => (
                      <div key={sIdx} className="text-xs flex items-center gap-2">
                        <span className="font-mono-code text-cyan-400 text-[10px]">
                          [H{step.hop}]
                        </span>
                        <span className="text-slate-200 font-semibold">{step.node}</span>
                        <span className="text-slate-500">via</span>
                        <span className="text-slate-300 italic text-[11px]">{step.via}</span>
                      </div>
                    ))}
                  </div>

                  {path.cut_fix_id && (
                    <div className="pt-2 border-t border-[#1c2638] flex items-center justify-between">
                      <span className="text-[11px] font-mono-code text-slate-400 flex items-center gap-1">
                        <Key className="w-3 h-3 text-cyan-400" /> Recommended Cut:
                      </span>
                      <Button
                        variant="primary"
                        size="xs"
                        loading={applyFixMutation.isPending}
                        onClick={() => applyFixMutation.mutate(path.cut_fix_id)}
                      >
                        Apply Cut Fix
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
