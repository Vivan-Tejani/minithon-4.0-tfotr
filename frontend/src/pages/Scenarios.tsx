import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useScenario, useAnalysis, useApplyFix, useState_ } from '../api/hooks'
import type { ScenarioRequest } from '../api/types'
import { Card, Button, Chip } from '../components/ui'
import { Graph, type GraphRef } from '../components/Graph'
import { Radio, ShieldCheck, Play, RotateCcw } from 'lucide-react'

export const Scenarios: React.FC = () => {
  const { data: analysis } = useAnalysis()
  const { data: appState } = useState_()
  const scenarioMutation = useScenario()
  const applyFixMutation = useApplyFix()
  const graphRef = useRef<GraphRef>(null)

  const [kind, setKind] = useState<'sim_swap' | 'lost_phone' | 'breach' | 'compromise'>('sim_swap')
  const [targetAccount, setTargetAccount] = useState<string>('netflix')
  const [currentHop, setCurrentHop] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  // Accounts list for breach/compromise selection
  const accounts = appState?.accounts ?? []

  // Execute scenario on change
  useEffect(() => {
    let req: ScenarioRequest
    if (kind === 'sim_swap') {
      req = { kind: 'entry', target: 'E_SIM' }
    } else if (kind === 'lost_phone') {
      req = { kind: 'entry', target: 'E_PHONE' }
    } else if (kind === 'breach') {
      req = { kind: 'breach', target: targetAccount }
    } else {
      req = { kind: 'compromise', target: targetAccount }
    }

    scenarioMutation.mutate(req)
    setCurrentHop(0)
    setIsPlaying(false)
  }, [kind, targetAccount])

  const scenario = scenarioMutation.data
  const maxHop = scenario?.cascade?.length ?? 0

  // Animate hop progression
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentHop((prev) => {
        if (prev >= maxHop) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1200)

    return () => clearInterval(interval)
  }, [isPlaying, maxHop])

  // Determine highlighted accounts based on current hop slider value
  const highlightIds = useMemo(() => {
    if (!scenario?.cascade) return []
    const ids: string[] = []

    // Always include entry vector
    if (kind === 'sim_swap') ids.push('E_SIM')
    if (kind === 'lost_phone') ids.push('E_PHONE')
    if (kind === 'breach' || kind === 'compromise') ids.push(targetAccount)

    scenario.cascade.forEach((round) => {
      if (round.round <= currentHop) {
        round.accounts.forEach((a) => ids.push(a.id))
      }
    })

    return ids
  }, [scenario, currentHop, kind, targetAccount])

  return (
    <div className="space-y-6">
      {/* Header and Scenario Selector */}
      <div className="bg-[#0b1222] border border-[#1c2638] rounded-lg p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-cyan-400">
            <Radio className="w-4 h-4" />
            <span>Interactive Breach & Compromise Simulator</span>
          </div>
          <h2 className="text-xl font-bold font-mono-code text-slate-100 mt-1">
            Simulate Adversarial Attack Vectors
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Force a single entry point or account breach to observe the deterministic domino cascade step-by-step.
          </p>
        </div>

        {/* Kind Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1c2638] text-xs font-mono-code">
          <button
            onClick={() => setKind('sim_swap')}
            className={`px-3 py-2 rounded-md transition-all cursor-pointer ${
              kind === 'sim_swap'
                ? 'bg-red-950/80 text-red-200 border border-red-800 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                : 'bg-[#0e1628] text-slate-400 hover:text-slate-200 border border-[#1e2a42]'
            }`}
          >
            SIM Swap / Intercept
          </button>

          <button
            onClick={() => setKind('lost_phone')}
            className={`px-3 py-2 rounded-md transition-all cursor-pointer ${
              kind === 'lost_phone'
                ? 'bg-red-950/80 text-red-200 border border-red-800 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                : 'bg-[#0e1628] text-slate-400 hover:text-slate-200 border border-[#1e2a42]'
            }`}
          >
            Lost / Stolen Phone
          </button>

          <button
            onClick={() => setKind('breach')}
            className={`px-3 py-2 rounded-md transition-all cursor-pointer ${
              kind === 'breach'
                ? 'bg-red-950/80 text-red-200 border border-red-800 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                : 'bg-[#0e1628] text-slate-400 hover:text-slate-200 border border-[#1e2a42]'
            }`}
          >
            Service Credential Leak
          </button>

          <button
            onClick={() => setKind('compromise')}
            className={`px-3 py-2 rounded-md transition-all cursor-pointer ${
              kind === 'compromise'
                ? 'bg-red-950/80 text-red-200 border border-red-800 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                : 'bg-[#0e1628] text-slate-400 hover:text-slate-200 border border-[#1e2a42]'
            }`}
          >
            Account Hijack / Phished
          </button>

          {(kind === 'breach' || kind === 'compromise') && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-slate-400 text-xs">Target Account:</span>
              <select
                value={targetAccount}
                onChange={(e) => setTargetAccount(e.target.value)}
                className="bg-[#070b14] border border-[#1c2638] rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.id})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Scenario Result Header */}
      {scenario && (
        <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-code font-bold uppercase tracking-wider text-red-400">
                  Simulation Outcome
                </span>
                {scenario.leaked_group && (
                  <Chip variant="warning" size="xs">
                    Exposes Password Group {scenario.leaked_group}
                  </Chip>
                )}
              </div>
              <p className="text-sm font-bold text-slate-100 font-mono-code">
                {scenario.falls === 0 ? (
                  <span className="text-emerald-400">
                    Device Lock holds: 0 accounts fall from lost phone scenario.
                  </span>
                ) : (
                  <>
                    A {scenario.scenario.label} would take over{' '}
                    <span className="text-red-400 font-black">{scenario.falls} accounts</span> in{' '}
                    {scenario.cascade.length} rounds; posture score drops from{' '}
                    <span className="text-amber-400">41</span> →{' '}
                    <span className="text-red-500 font-black">{scenario.score_during}</span>.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 font-mono-code text-xs">
              <div className="p-2.5 bg-[#070b14] border border-red-950 rounded text-right">
                <span className="text-[10px] text-slate-400 block">Posture During Attack</span>
                <span className="text-lg font-bold text-red-400">{scenario.score_during}/100</span>
              </div>
              <div className="p-2.5 bg-[#070b14] border border-red-950 rounded text-right">
                <span className="text-[10px] text-slate-400 block">Loss Spike (ΔEL)</span>
                <span className="text-lg font-bold text-amber-400">+{scenario.el_delta.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hop Progression Slider Bar */}
      {maxHop > 0 && (
        <Card
          title="Blast Radius Hop Progression"
          subtitle="Step through attack rounds to trace compromised accounts on the graph below"
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  setCurrentHop(0)
                  setIsPlaying(true)
                }}
                icon={isPlaying ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              >
                {isPlaying ? 'Replaying...' : 'Play Cascade'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={maxHop}
                step={1}
                value={currentHop}
                onChange={(e) => {
                  setIsPlaying(false)
                  setCurrentHop(Number(e.target.value))
                }}
                className="w-full h-2 bg-[#121a2c] rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <span className="font-mono-code text-sm font-bold text-cyan-300 min-w-[70px] text-right">
                Hop {currentHop} / {maxHop}
              </span>
            </div>

            {/* Cascade Rounds Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {scenario?.cascade.map((round) => {
                const isActive = round.round <= currentHop
                return (
                  <div
                    key={round.round}
                    className={`p-3 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-red-950/30 border-red-800/80 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                        : 'bg-[#090d18] border-[#1c2638] opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono-code mb-2">
                      <span className="font-bold text-red-300">Round #{round.round}</span>
                      <span className="text-[11px] text-slate-400">
                        {round.accounts.length} compromised
                      </span>
                    </div>

                    <div className="space-y-1.5 pl-2 border-l border-red-900/50">
                      {round.accounts.map((a) => (
                        <div key={a.id} className="text-xs">
                          <span className="font-bold text-slate-100">{a.id}</span>
                          <span className="text-[11px] text-slate-400 block italic leading-tight">
                            via {a.via}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Graph Visualizer highlighting current hop accounts */}
      <Card
        title="Live Cascade Attack Topology"
        subtitle="Active compromised accounts highlighted; untouched accounts dimmed"
      >
        {analysis?.graph && (
          <Graph
            ref={graphRef}
            view={analysis.graph}
            highlightIds={highlightIds}
            height={440}
          />
        )}
      </Card>

      {/* Immediate Remediation Recommendations */}
      {scenario?.next_actions && scenario.next_actions.length > 0 && (
        <Card
          title="Recommended Targeted Countermeasures"
          subtitle="Specific mitigations to neutralize this attack trajectory"
          action={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
        >
          <div className="space-y-3">
            {scenario.next_actions.map((action) => (
              <div
                key={action.id}
                className="p-3.5 bg-[#0a0f1d] border border-[#1c2638] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Chip variant="accent" size="xs">
                      {action.effort.toUpperCase()} EFFORT
                    </Chip>
                    <span className="text-xs font-bold text-slate-100">{action.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{action.why}</p>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  loading={applyFixMutation.isPending}
                  onClick={() => applyFixMutation.mutate(action.id)}
                >
                  Apply Fix
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
