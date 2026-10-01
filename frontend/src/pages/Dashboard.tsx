import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  useAnalysis,
  useFixes,
  useSnapshots,
  useSelection,
  useApplyFix,
} from '../api/hooks'
import { Card, Stat, BandBadge, Skeleton, Button } from '../components/ui'
import { Graph, type GraphRef } from '../components/Graph'
import { SpofPanel } from '../components/SpofPanel'
import { CrownPath } from '../components/CrownPath'
import { BaselineCompare } from '../components/BaselineCompare'
import {
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  AlertOctagon,
  Smartphone,
  Layers,
  ChevronRight,
  Zap,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

export const Dashboard: React.FC = () => {
  const { data: analysis, isLoading: isAnalysisLoading } = useAnalysis()
  const { data: fixes } = useFixes()
  const { data: snapshots } = useSnapshots()
  const { openAccountDetail, ghostView } = useSelection()
  const applyFixMutation = useApplyFix()
  const graphRef = useRef<GraphRef>(null)

  const score = analysis?.score ?? 0
  const scoreColor =
    score < 40 ? 'text-red-400' : score < 70 ? 'text-amber-400' : 'text-emerald-400'
  const scoreBg =
    score < 40
      ? 'border-red-900/60 bg-red-950/20 shadow-[0_0_25px_rgba(239,68,68,0.15)]'
      : score < 70
      ? 'border-amber-900/60 bg-amber-950/20 shadow-[0_0_25px_rgba(245,158,11,0.15)]'
      : 'border-emerald-900/60 bg-emerald-950/20 shadow-[0_0_25px_rgba(16,185,129,0.15)]'

  const totalAccounts = analysis?.accounts.length ?? 0
  const highRiskAccounts =
    analysis?.accounts.filter((a) => a.band === 'high').length ?? 0
  const spofCount = analysis?.spofs.length ?? 0
  const simSwapReachable =
    analysis?.spofs.find((s) => s.id === 'E_SIM')?.falls ?? 0

  const riskiestTop5 = [...(analysis?.accounts ?? [])]
    .sort((a, b) => b.p - a.p)
    .slice(0, 5)

  // Best-3 projected score
  const best3Fixes = fixes?.plan.filter((f) => f.in_best3) ?? []
  const projectedBestScore =
    best3Fixes.length > 0 ? best3Fixes[best3Fixes.length - 1].score_after : null

  return (
    <div className="space-y-6">
      {/* Best-3 Remediation Banner */}
      {projectedBestScore && projectedBestScore > score && (
        <div className="bg-gradient-to-r from-[#0d1c33] via-[#102342] to-[#0c182b] border border-cyan-500/50 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-code font-bold uppercase tracking-wider text-cyan-300">
                  Counterfactual Recommendation
                </span>
                <span className="text-[10px] font-mono-code bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800 text-cyan-300">
                  CELF OPTIMIZED
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-100 mt-0.5">
                Apply top 3 fixes to increase posture score from{' '}
                <span className="font-mono-code text-amber-400">{score}</span> to{' '}
                <span className="font-mono-code text-emerald-400">
                  {projectedBestScore}
                </span>{' '}
                (+{projectedBestScore - score} pts)
              </p>
            </div>
          </div>

          <Link
            to="/fixes"
            className="inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-xs font-mono-code transition-all shadow hover:shadow-[0_0_12px_rgba(6,182,212,0.5)]"
          >
            Review Fix Plan <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Primary Posture Overview & Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Score & Headline Card */}
        <div
          className={`lg:col-span-4 rounded-lg border p-6 flex flex-col justify-between ${scoreBg}`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono-code uppercase tracking-wider text-slate-400">
                Audited Privacy Score
              </span>
              <span className="text-[11px] font-mono-code text-slate-400">
                Range 0–100
              </span>
            </div>

            {/* Gauge Display */}
            <div className="my-6 text-center">
              <div className="relative inline-flex items-baseline justify-center">
                <span
                  className={`text-6xl font-black font-mono-code tracking-tighter ${scoreColor}`}
                >
                  {isAnalysisLoading ? '--' : score}
                </span>
                <span className="text-sm text-slate-500 font-mono-code ml-1">/100</span>
              </div>

              <div className="w-full bg-[#111726] h-2.5 rounded-full overflow-hidden mt-4 border border-[#1e2a42]">
                <div
                  className={`h-full transition-all duration-500 ${
                    score < 40
                      ? 'bg-red-500'
                      : score < 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
                />
              </div>
            </div>

            {/* Headline Diagnostic */}
            <div className="bg-[#080d18]/80 border border-[#1c2638] rounded-md p-3">
              <p className="text-xs text-slate-200 leading-relaxed font-mono-code">
                {isAnalysisLoading ? (
                  <Skeleton className="h-4 w-full" />
                ) : (
                  analysis?.headline
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1c2638]/70 flex items-center justify-between text-[10px] text-slate-400 font-mono-code">
            <span>Expected Loss (EL): {analysis?.el.toFixed(1)}</span>
            <span>Worst Case: {analysis?.worst.toFixed(1)}</span>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Stat
            label="Total Accounts"
            value={totalAccounts}
            subtext="Tracked services & apps"
            icon={<Layers className="w-4 h-4 text-cyan-400" />}
          />
          <Stat
            label="High-Risk Accounts"
            value={highRiskAccounts}
            subtext="Takeover P ≥ 40%"
            trend={highRiskAccounts > 0 ? 'danger' : 'neutral'}
            icon={<ShieldAlert className="w-4 h-4 text-red-400" />}
          />
          <Stat
            label="Single Points of Failure"
            value={spofCount}
            subtext="Critical root nodes"
            trend={spofCount > 0 ? 'danger' : 'neutral'}
            icon={<AlertOctagon className="w-4 h-4 text-amber-400" />}
          />
          <Stat
            label="SIM Swap Reach"
            value={`${simSwapReachable} accts`}
            subtext="Reachable via phone intercept"
            trend="danger"
            icon={<Smartphone className="w-4 h-4 text-red-400" />}
          />

          {/* Riskiest Accounts Preview inside the KPI section */}
          <div className="col-span-2 sm:col-span-2 md:col-span-4 bg-[#0d131f] border border-[#1c2638] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Top 5 Vulnerable Accounts
              </span>
              <Link
                to="/accounts"
                className="text-xs font-mono-code text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                View All {totalAccounts} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              {riskiestTop5.map((acct) => (
                <div
                  key={acct.id}
                  onClick={() => openAccountDetail(acct.id)}
                  className="bg-[#080d18] hover:bg-[#111728] border border-[#1c2638] hover:border-cyan-800/80 p-2.5 rounded cursor-pointer transition-colors"
                >
                  <p className="text-xs font-bold text-slate-100 truncate">{acct.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <BandBadge band={acct.band} probability={acct.p} size="sm" />
                    <span className="text-[10px] font-mono-code text-slate-400">
                      Imp {acct.impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Attack Graph View */}
      <Card
        title="Interactive Exposure & Attack Graph"
        subtitle="Hierarchical recovery graph: Entry Points & Shared Groups → Central Hubs → Connected Services"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => graphRef.current?.fit()}
            >
              Fit Canvas
            </Button>
          </div>
        }
      >
        {isAnalysisLoading ? (
          <Skeleton className="h-[480px]" />
        ) : analysis?.graph ? (
          <Graph
            ref={graphRef}
            view={analysis.graph}
            ghost={ghostView}
            onSelect={(id) => openAccountDetail(id)}
            height={480}
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500 font-mono-code">
            No graph nodes generated.
          </div>
        )}
      </Card>

      {/* Analysis Panels: SPOFs, Crown Jewel & Baseline Compare */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analysis?.spofs && (
          <SpofPanel
            spofs={analysis.spofs}
            onSelectCandidate={(id) => {
              if (id.startsWith('ACC:')) {
                openAccountDetail(id.replace('ACC:', ''))
              }
            }}
          />
        )}

        <div className="space-y-6">
          <CrownPath
            crown={analysis?.crown_path ?? null}
            loadingFix={applyFixMutation.isPending}
            onFixClick={(fixId) => applyFixMutation.mutate(fixId)}
          />

          {/* Baseline Compare Demo Slot */}
          <BaselineCompare
            compare={{
              baseline_top3: [
                { id: '2fa:netflix', title: 'Add 2FA to Netflix (PW Group A member)' },
                { id: 'unique_pw:netflix', title: 'Change Netflix password' },
                { id: '2fa:amazon', title: 'Add Authenticator 2FA to Amazon' },
              ],
              chokepoint_top3: [
                { id: 'sim_lock', title: 'Turn on SIM lock (Carrier PIN)' },
                { id: 'unique_pw:A', title: 'Separate Password Group A' },
                { id: 'revoke:photoedit', title: 'Revoke Gmail Inbox token from Photo App' },
              ],
              baseline_score_after: 49,
              chokepoint_score_after: 72,
              divergence_explanation:
                'Independent checkers fix single high-reuse nodes first; Chokepoint identifies correlated root gates (SIM swap and central email inbox).',
            }}
          />
        </div>
      </div>

      {/* Posture Trend Over Time (Recharts Line) */}
      <Card
        title="Privacy Posture Score Evolution"
        subtitle="Snapshot history recorded across security audits, fix applications, and inventory changes"
        action={<TrendingUp className="w-4 h-4 text-emerald-400" />}
      >
        {snapshots && snapshots.length > 0 ? (
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snapshots}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2638" />
                <XAxis
                  dataKey="ts"
                  stroke="#64748b"
                  fontSize={10}
                  tickFormatter={(val) => {
                    const d = new Date(val)
                    return `${d.getMonth() + 1}/${d.getDate()}`
                  }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  domain={[0, 100]}
                  tickCount={6}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-[#090e1a] border border-[#1e2a42] p-2.5 rounded shadow-xl font-mono-code text-xs">
                          <p className="text-cyan-400 font-bold">
                            Score: {data.score} / 100
                          </p>
                          <p className="text-slate-300 text-[11px] mt-0.5">
                            {data.label}
                          </p>
                          <p className="text-slate-400 text-[10px] mt-1">
                            EL: {data.el} • {new Date(data.ts).toLocaleDateString()}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#080c14', stroke: '#06b6d4', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#38bdf8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-slate-500 font-mono-code text-xs">
            Apply a fix or seed persona to view posture trend telemetry.
          </div>
        )}
      </Card>
    </div>
  )
}
