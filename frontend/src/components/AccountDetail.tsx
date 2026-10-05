import React from 'react'
import { useSelection, useAnalysis, useApplyFix } from '../api/hooks'
import { Drawer, BandBadge, Button } from './ui'

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
      <Drawer isOpen={isOpen} onClose={handleClose} title="Account details" width="md">
        <p className="text-zinc-500 text-xs">Select an account to view vulnerability telemetry.</p>
      </Drawer>
    )
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={account.name}
      subtitle={`Account key: ${account.id}`}
      width="md"
    >
      <div className="space-y-6">
        {/* Risk & Impact Header */}
        <div className="flex items-center justify-between p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg">
          <div className="flex items-center gap-3">
            <BandBadge band={account.band} probability={account.p} size="md" />
            <span className="text-xs text-zinc-400">
              Impact: <strong className="text-zinc-100 font-normal">{account.impact}/10</strong>
            </span>
          </div>
          <span className="text-xs font-mono-code text-zinc-300">
            {Math.round(account.p * 100)}% takeover likelihood
          </span>
        </div>

        {/* Narrative Explanation */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-zinc-400">
            Diagnostic summary
          </h4>
          <p className="text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 p-3 rounded-lg leading-relaxed">
            {account.why}
          </p>
        </div>

        {/* Contributing Factors */}
        {account.reasons && account.reasons.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-zinc-400">
              Contributing vectors
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {account.reasons.map((r, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-0.5 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Attack Paths */}
        {account.top_paths && account.top_paths.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-zinc-400">
              Attack trajectories
            </h4>
            <div className="space-y-2.5">
              {account.top_paths.map((path, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-200">
                      Route #{idx + 1}
                    </span>
                    <span className="font-mono-code text-[11px] text-zinc-500">
                      Likelihood: {Math.round(path.likelihood * 100)}%
                    </span>
                  </div>

                  <div className="space-y-1 pl-2 border-l border-zinc-700">
                    {path.steps.map((step, sIdx) => (
                      <div key={sIdx} className="text-xs flex items-center gap-2 text-zinc-300">
                        <span className="font-mono-code text-zinc-500 text-[10px]">
                          [H{step.hop}]
                        </span>
                        <span className="text-zinc-100">{step.node}</span>
                        <span className="text-zinc-500">→</span>
                        <span className="text-zinc-400">{step.via}</span>
                      </div>
                    ))}
                  </div>

                  {path.cut_fix_id && (
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">
                        Remediation: <span className="font-mono-code text-zinc-200">{path.cut_fix_id}</span>
                      </span>
                      <Button
                        size="xs"
                        loading={applyFixMutation.isPending}
                        onClick={() => applyFixMutation.mutate(path.cut_fix_id)}
                      >
                        Apply fix
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
