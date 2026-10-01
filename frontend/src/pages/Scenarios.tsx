import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useScenario, useAnalysis, useApplyFix, useState_, useSelection, useSeedDemo } from '../api/hooks'
import type { ScenarioRequest } from '../api/types'
import { Card, Button, Chip, Skeleton } from '../components/ui'
import { Graph, type GraphRef } from '../components/Graph'
import { FixCard } from '../components/FixCard'
import {
  Radio,
  ShieldCheck,
  Play,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from 'lucide-react'

export const Scenarios: React.FC = () => {
  useEffect(() => {
    document.title = 'Attack Scenarios & Blast Radius | Chokepoint Auditor'
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

  // Accounts list for breach/compromise selection
  const accounts = useMemo(() => appState?.accounts ?? [], [appState])

  // Sync valid target account when account list changes
  useEffect(() => {
    if (accounts.length > 0 && !accounts.some((a) => a.id === targetAccount)) {
      setTargetAccount(accounts[0].id)
    }
  }, [accounts, targetAccount])

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
  const baseScore = analysis?.score ?? 41

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
    }, 1100)

    return () => clearInterval(interval)
  }, [isPlaying, maxHop])

  // Determine highlighted accounts based on current hop slider value
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

    // Always include entry origin node
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
      ? 'Lost phone'
      : kind === 'breach'
      ? 'Service credential leak'
      : 'Account compromise'

  return (
    <div className="space-y-6">
      {/* Header and Scenario Selector */}
      <div className="bg-[#0b1222] border border-[#1c2638] rounded-lg p-5 space-y-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-cyan-400">
            <Radio className="w-4 h-4" />
            <span>Interactive Adversarial Attack Simulator</span>
          </div>
          <h2 className="text-xl font-bold font-mono-code text-slate-100 mt-1">
            Simulate Attack Scenarios & Blast Radius
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Evaluate blast radius cascades across your identity fabric under distinct adversarial entry conditions.
          </p>
        </div>

        {/* Kind Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#1c2638] text-xs font-mono-code">
          <button
            onClick={() => setKind('sim_swap')}
            className={`px-3.5 py-2 rounded-md transition-all cursor-pointer font-semibold ${
              kind === 'sim_swap'
                ? 'bg-red-950/80 text-red-200 border border-red-700 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                : 'bg-[#0e1628] text-slate-400 hover:text-slate-200 border border-[#1e2a42]'
            }`}
          >
            SIM Swap
          </button>

          <button
            onClick={() => setKind('lost_phone')}
            className={`px-3.5 py-2 rounded-md transition-all cursor-pointer font-semibold ${
              kind === 'lost_phone'
                ? 'bg-red-950/80 text-red-200 border border-red-700 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                : 'bg-[#0e1628] text-slate-400 hover:text-slate-200 border border-[#1e2a42]'
            }`}
          >
            Lost Phone
          </button>

          <button
            onClick={() => setKind('breach')}
            className={`px-3.5 py-2 rounded-md transition-all cursor-pointer font-semibold ${
              kind === 'breach'
                ? 'bg-red-950/80 text-red-200 border border-red-700 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                : 'bg-[#0e1628] text-slate-400 hover:text-slate-200 border border-[#1e2a42]'
            }`}
          >
            Service Breached
          </button>

          <button
            onClick={() => setKind('compromise')}
            className={`px-3.5 py-2 rounded-md transition-all cursor-pointer font-semibold ${
              kind === 'compromise'
                ? 'bg-red-950/80 text-red-200 border border-red-700 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                : 'bg-[#0e1628] text-slate-400 hover:text-slate-200 border border-[#1e2a42]'
            }`}
          >
            Account Compromised
          </button>

          {(kind === 'breach' || kind === 'compromise') && (
            <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto mt-2 sm:mt-0">
              <span className="text-slate-400 text-xs whitespace-nowrap">Target Account:</span>
              <select
                value={targetAccount}
                onChange={(e) => setTargetAccount(e.target.value)}
                className="bg-[#070b14] border border-cyan-900/60 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono-code w-full sm:w-auto"
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

      {/* Error Banner with Retry */}
      {scenarioMutation.isError && (
        <div className="p-4 bg-red-950/40 border border-red-800 rounded-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-200">Failed to simulate attack scenario</p>
              <p className="text-xs text-red-400/80">Unable to query /scenario cascade projection data.</p>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              let req: ScenarioRequest
              if (kind === 'sim_swap') req = { kind: 'entry', target: 'E_SIM' }
              else if (kind === 'lost_phone') req = { kind: 'entry', target: 'E_PHONE' }
              else if (kind === 'breach') req = { kind: 'breach', target: targetAccount }
              else req = { kind: 'compromise', target: targetAccount }
              scenarioMutation.mutate(req)
            }}
          >
            Retry Simulation
          </Button>
        </div>
      )}

      {/* Empty State when no accounts exist */}
      {accounts.length === 0 && (
        <Card>
          <div className="py-12 px-4 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center mx-auto text-cyan-400 mb-4 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Radio className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold font-mono-code text-slate-100">
              No Accounts Available for Simulation
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Attack scenario cascades require accounts and identity anchors to simulate SIM swaps, device theft, service breaches, and password compromise cascades.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="primary"
                size="sm"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                icon={<Sparkles className="w-4 h-4" />}
              >
                {seedMutation.isPending ? 'Seeding Persona...' : 'Load Demo Persona'}
              </Button>
              <Link to="/accounts">
                <Button variant="outline" size="sm">
                  Add Accounts
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Loading Skeletons */}
      {scenarioMutation.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      )}

      {/* Scenario Outcome Banner (PRD Diagnostic Format) */}
      {!scenarioMutation.isPending && scenario && (
        <div className="bg-red-950/25 border border-red-900/60 rounded-lg p-5 shadow-lg space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono-code font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  SIMULATION OUTCOME
                </span>
                {scenario.leaked_group && (
                  <Chip variant="warning" size="xs">
                    Exposes Password Group: {scenario.leaked_group}
                  </Chip>
                )}
                {scenario.falls === 0 && (
                  <Chip variant="success" size="xs">
                    POSTURE DEFENDED
                  </Chip>
                )}
              </div>

              {/* Canonical PRD Sentence */}
              <p className="text-base font-bold text-slate-100 font-mono-code leading-relaxed">
                {scenario.falls === 0 ? (
                  <span className="text-emerald-400">
                    Device lock holds: 0 accounts fall from lost phone scenario.
                  </span>
                ) : (
                  <>
                    A {scenarioLabel} would take over{' '}
                    <span className="text-red-400 underline decoration-red-600 font-black">
                      {scenario.falls} accounts
                    </span>{' '}
                    in {scenario.cascade.length} {scenario.cascade.length === 1 ? 'step' : 'steps'}; score drops{' '}
                    <span className="text-amber-400 font-bold">{baseScore}</span> →{' '}
                    <span className="text-red-500 font-black">{scenario.score_during}</span>.
                  </>
                )}
              </p>
            </div>

            {/* Impact Metric Cards */}
            <div className="flex items-center gap-3 font-mono-code text-xs">
              <div className="p-3 bg-[#070b14]/90 border border-red-950/80 rounded-lg text-right min-w-[130px]">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Score During Attack
                </span>
                <span className="text-xl font-bold text-red-400 font-mono-code">
                  {scenario.score_during}
                  <span className="text-xs text-slate-500">/100</span>
                </span>
              </div>
              <div className="p-3 bg-[#070b14]/90 border border-amber-950/80 rounded-lg text-right min-w-[120px]">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Expected Loss Spike
                </span>
                <span className="text-xl font-bold text-amber-400 font-mono-code">
                  +{scenario.el_delta.toFixed(1)}
                  <span className="text-xs text-slate-500"> EL</span>
                </span>
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
          <div className="space-y-5">
            <div className="flex items-center gap-4 bg-[#080d1a] p-3 rounded-lg border border-[#1b263b]">
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
                className="w-full h-2.5 bg-[#121a2c] rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="font-mono-code text-xs font-bold text-cyan-300 min-w-[90px] text-right bg-[#0f172a] px-2.5 py-1 rounded border border-cyan-900/60">
                Round {currentHop} / {maxHop}
              </span>
            </div>

            {/* Cascade Rounds Breakdown with clickable account triggers */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scenario?.cascade.map((round) => {
                const isActive = round.round <= currentHop
                return (
                  <div
                    key={round.round}
                    className={`p-3.5 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-red-950/30 border-red-800/80 shadow-[0_0_14px_rgba(239,68,68,0.2)]'
                        : 'bg-[#090d18] border-[#1c2638] opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono-code mb-2.5 pb-1.5 border-b border-[#1c2638]">
                      <span className="font-bold text-red-300 flex items-center gap-1.5">
                        <ArrowRight className="w-3 h-3 text-red-400" /> Round #{round.round}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {round.accounts.length} {round.accounts.length === 1 ? 'account' : 'accounts'} compromised
                      </span>
                    </div>

                    <div className="space-y-2 pl-2 border-l border-red-900/60">
                      {round.accounts.map((a) => (
                        <div key={a.id} className="text-xs group">
                          <button
                            onClick={() => openAccountDetail(a.id)}
                            className="font-bold text-slate-100 hover:text-cyan-300 flex items-center gap-1 text-left cursor-pointer transition-colors"
                            title="Inspect account vulnerability profile"
                          >
                            <span>{a.id}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-cyan-400 transition-opacity" />
                          </button>
                          <span className="text-[11px] text-slate-400 block italic leading-tight mt-0.5">
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
        title="Cascade Attack Topology & Blast Radius"
        subtitle="Compromised accounts highlighted in red; unaffected accounts dimmed"
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

      {/* "What to do next": Next Actions Remediations using FixCard */}
      {scenario?.next_actions && scenario.next_actions.length > 0 && (
        <Card
          title="What to do next — Neutralize this Attack Trajectory"
          subtitle="Targeted countermeasures ranked to eliminate this specific cascade"
          action={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
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
