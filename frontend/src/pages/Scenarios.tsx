import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useScenario, useAnalysis, useApplyFix, useState_, useSelection, useSeedDemo } from '../api/hooks'
import type { ScenarioRequest } from '../api/types'
import { Card, Button, Skeleton } from '../components/ui'
import { Graph, type GraphRef } from '../components/Graph'
import { FixCard } from '../components/FixCard'
import {
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react'

export const Scenarios: React.FC = () => {
  useEffect(() => {
    document.title = 'Attack scenarios · Chokepoint'
  }, [])

  const { data: analysis } = useAnalysis()
  const { data: appState } = useState_()
  const scenarioMutation = useScenario()
  const applyFixMutation = useApplyFix()
  const seedMutation = useSeedDemo()
  const { openAccountDetail } = useSelection()
  const graphRef = useRef<GraphRef>(null)

  const [kind, setKind] = useState<'sim_swap' | 'lost_phone' | 'breach' | 'compromise'>('sim_swap')
  const [targetAccount, setTargetAccount] = useState<string>('netflix')
  const [currentHop, setCurrentHop] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [appliedFixIds, setAppliedFixIds] = useState<Set<string>>(new Set())

  const accounts = useMemo(() => appState?.accounts ?? [], [appState])

  useEffect(() => {
    if (accounts.length > 0 && !accounts.some((a) => a.id === targetAccount)) {
      setTargetAccount(accounts[0].id)
    }
  }, [accounts, targetAccount])

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
  const baseScore = analysis?.score ?? 41

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
    }, 1100)

    return () => clearInterval(interval)
  }, [isPlaying, maxHop])

  const highlightIds = useMemo(() => {
    if (!scenario?.cascade) return []
    const ids = new Set<string>()

    const addId = (rawId: string) => {
      ids.add(rawId)
      if (rawId.startsWith('ACC:')) {
        ids.add(rawId.replace('ACC:', ''))
      } else {
        ids.add(`ACC:${rawId}`)
      }
    }

    if (kind === 'sim_swap') addId('E_SIM')
    if (kind === 'lost_phone') addId('E_PHONE')
    if (kind === 'breach' || kind === 'compromise') addId(targetAccount)

    scenario.cascade.forEach((round) => {
      if (round.round <= currentHop) {
        round.accounts.forEach((a) => addId(a.id))
      }
    })

    return Array.from(ids)
  }, [scenario, currentHop, kind, targetAccount])

  const handleApplyFix = async (fixId: string) => {
    try {
      await applyFixMutation.mutateAsync(fixId)
      setAppliedFixIds((prev) => new Set(prev).add(fixId))
    } catch {
      // Handled globally
    }
  }

  const scenarioLabel =
    kind === 'sim_swap'
      ? 'SIM swap'
      : kind === 'lost_phone'
      ? 'lost phone'
      : kind === 'breach'
      ? 'service credential breach'
      : 'account compromise'

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-50">
            Attack scenarios
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Simulate adversarial breach vectors and blast radius cascades across your identity fabric.
          </p>
        </div>

        {accounts.length === 0 && (
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

      {/* Scenario Selector Card */}
      <Card>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">
              Scenario entry vector
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select an initial compromise trigger to trace its propagation cascade.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800 text-xs">
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
              <button
                onClick={() => setKind('sim_swap')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  kind === 'sim_swap'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                SIM swap
              </button>
              <button
                onClick={() => setKind('lost_phone')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  kind === 'lost_phone'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Lost phone
              </button>
              <button
                onClick={() => setKind('breach')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  kind === 'breach'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Service breach
              </button>
              <button
                onClick={() => setKind('compromise')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  kind === 'compromise'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Account compromise
              </button>
            </div>

            {(kind === 'breach' || kind === 'compromise') && (
              <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto mt-2 sm:mt-0">
                <span className="text-zinc-400 text-xs whitespace-nowrap">Target account:</span>
                <select
                  value={targetAccount}
                  onChange={(e) => setTargetAccount(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700 w-full sm:w-auto"
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
      </Card>

      {/* Empty State */}
      {accounts.length === 0 && (
        <Card className="py-12 px-4 text-center max-w-md mx-auto">
          <h3 className="text-sm font-medium text-zinc-100">
            No accounts available for simulation
          </h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Attack scenarios require accounts in inventory to calculate recovery graphs and propagation cascades.
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
                Add accounts
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Loading Skeletons */}
      {scenarioMutation.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {/* Simulation Outcome Card */}
      {!scenarioMutation.isPending && scenario && (
        <Card>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-400">Simulation outcome</span>
                {scenario.falls === 0 ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Posture defended
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    {scenario.falls} accounts compromised
                  </span>
                )}
              </div>

              <p className="text-sm text-zinc-200 leading-relaxed">
                {scenario.falls === 0 ? (
                  <span>Device lock holds: 0 accounts fall from lost phone scenario.</span>
                ) : (
                  <>
                    A {scenarioLabel} would compromise{' '}
                    <span className="font-semibold text-zinc-50">{scenario.falls} accounts</span> in{' '}
                    {scenario.cascade.length} {scenario.cascade.length === 1 ? 'step' : 'steps'}. Posture score drops from{' '}
                    <span className="font-semibold text-zinc-400 font-mono-code">{baseScore}</span> to{' '}
                    <span className="font-semibold text-red-400 font-mono-code">{scenario.score_during}</span>.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-right min-w-[130px]">
                <span className="text-zinc-500 text-[11px] block">Score during attack</span>
                <span className="text-lg font-semibold text-red-400 font-mono-code tabular-nums">
                  {scenario.score_during}
                  <span className="text-xs text-zinc-500 font-normal"> / 100</span>
                </span>
              </div>
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-right min-w-[130px]">
                <span className="text-zinc-500 text-[11px] block">Expected loss spike</span>
                <span className="text-lg font-semibold text-amber-400 font-mono-code tabular-nums">
                  +{scenario.el_delta.toFixed(1)}
                  <span className="text-xs text-zinc-500 font-normal"> EL</span>
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Hop Progression Slider Bar */}
      {maxHop > 0 && (
        <Card
          title="Blast radius hop progression"
          subtitle="Step through attack rounds to trace compromised accounts on the graph below"
          action={
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setCurrentHop(0)
                setIsPlaying(true)
              }}
            >
              {isPlaying ? <RotateCcw className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
              {isPlaying ? 'Replaying' : 'Play cascade'}
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
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
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-100"
              />
              <span className="text-xs font-medium text-zinc-300 min-w-[80px] text-right">
                Round {currentHop} / {maxHop}
              </span>
            </div>

            {/* Cascade Rounds Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scenario?.cascade.map((round) => {
                const isActive = round.round <= currentHop
                return (
                  <div
                    key={round.round}
                    className={`p-3 rounded-lg border transition-colors ${
                      isActive
                        ? 'border-zinc-700 bg-zinc-900/60'
                        : 'border-zinc-800/60 bg-zinc-900/20 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-2 pb-1.5 border-b border-zinc-800">
                      <span className="font-medium text-zinc-200">
                        Round {round.round}
                      </span>
                      <span className="text-zinc-500 text-[11px]">
                        {round.accounts.length} {round.accounts.length === 1 ? 'account' : 'accounts'}
                      </span>
                    </div>

                    <div className="space-y-1.5 pl-2 border-l border-zinc-800">
                      {round.accounts.map((a) => (
                        <div key={a.id} className="text-xs">
                          <button
                            onClick={() => openAccountDetail(a.id)}
                            className="font-medium text-zinc-200 hover:text-zinc-50 text-left cursor-pointer"
                          >
                            {a.id}
                          </button>
                          <span className="text-[11px] text-zinc-500 block leading-tight">
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
        title="Attack topology and cascade path"
        subtitle="Compromised accounts highlighted; unaffected accounts dimmed"
      >
        {analysis?.graph && (
          <Graph
            ref={graphRef}
            view={analysis.graph}
            highlightIds={highlightIds}
            onSelect={openAccountDetail}
            height={460}
          />
        )}
      </Card>

      {/* Next Actions Remediations */}
      {scenario?.next_actions && scenario.next_actions.length > 0 && (
        <Card
          title="Recommended countermeasures"
          subtitle="Targeted fixes that eliminate this specific cascade"
        >
          <div className="space-y-3">
            {scenario.next_actions.map((action) => (
              <FixCard
                key={action.id}
                fix={action}
                onApply={handleApplyFix}
                isApplying={applyFixMutation.isPending}
                isApplied={appliedFixIds.has(action.id)}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
