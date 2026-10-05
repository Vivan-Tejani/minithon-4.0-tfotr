import React from 'react'
import type { Path } from '../api/types'
import { Card, Button, BandBadge } from './ui'
import { CornerDownRight } from 'lucide-react'

export interface CrownPathProps {
  crown: {
    target: string
    path: Path
  } | null
  onFixClick?: (fixId: string) => void
  loadingFix?: boolean
}

export const CrownPath: React.FC<CrownPathProps> = ({ crown, onFixClick, loadingFix = false }) => {
  if (!crown) {
    return (
      <Card title="Crown jewel protection" subtitle="Designated high-value target assets">
        <p className="text-xs text-zinc-500">No crown jewel target currently designated.</p>
      </Card>
    )
  }

  const { target, path } = crown

  return (
    <Card
      title="Crown jewel path"
      subtitle={`Shortest attack route to compromise ${target}`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Target</span>
            <span className="font-medium text-zinc-100">{target}</span>
          </div>
          <BandBadge band={path.band} probability={path.likelihood} size="sm" />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-400">
            Attack trajectory
          </p>
          <div className="space-y-1.5 pl-3 border-l border-zinc-700">
            {path.steps.map((step, idx) => (
              <div key={idx} className="text-xs flex items-center gap-2 text-zinc-300">
                <CornerDownRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                <span className="font-mono-code text-zinc-100">{step.node}</span>
                <span className="text-zinc-500">→</span>
                <span className="text-zinc-400">{step.via}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cut Fix */}
        {path.cut_fix_id && (
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs text-zinc-400 block">Remediation action</span>
              <span className="text-xs font-mono-code text-zinc-200">{path.cut_fix_id}</span>
            </div>
            <Button
              size="sm"
              loading={loadingFix}
              onClick={() => onFixClick?.(path.cut_fix_id)}
            >
              Remediate route
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
