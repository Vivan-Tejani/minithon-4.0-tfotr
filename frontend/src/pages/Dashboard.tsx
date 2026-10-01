import React, { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  useAnalysis,
  useFixes,
  useSnapshots,
  useSelection,
  useApplyFix,
  useSeedDemo,
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
  Info,
  ShieldCheck,
  AlertCircle,
  Sparkles,
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
  useEffect(() => {
    document.title = 'Security Dashboard | Chokepoint Auditor'
  }, [])

  const { data: analysis, isLoading: isAnalysisLoading, isError: isAnalysisError, refetch: refetchAnalysis } = useAnalysis()
  const { data: fixes } = useFixes()
  const { data: snapshots } = useSnapshots()
  const { openAccountDetail, ghostView } = useSelection()
  const applyFixMutation = useApplyFix()
  const seedMutation = useSeedDemo()
  const graphRef = useRef<GraphRef>(null)

  const score = analysis?.score ?? 0
  const el = analysis?.el ?? 0
  const worst = analysis?.worst ?? 1

  // Posture colors per PRD (< 40 red, 40-69 amber, >= 70 green)
  const scoreTheme =
    score < 40
      ? {
          text: 'text-red-400',
          stroke: '#ef4444',
          bg: 'border-red-900/60 bg-red-950/20 shadow-[0_0_25px_rgba(239,68,68,0.12)]',
          label: 'ELEVATED EXPOSURE',
        }
      : score < 70
      ? {
          text: 'text-amber-400',
          stroke: '#f59e0b',
          bg: 'border-amber-900/60 bg-amber-950/20 shadow-[0_0_25px_rgba(245,158,11,0.12)]',
          label: 'MODERATE RISK',
        }
      : {
          text: 'text-emerald-400',
          stroke: '#10b981',
          bg: 'border-emerald-900/60 bg-emerald-950/20 shadow-[0_0_25px_rgba(16,185,129,0.12)]',
          label: 'HARDENED POSTURE',
        }

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

  // Radial gauge geometry
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="space-y-6">
      {/* Best-3 Remediation Banner */}
      {projectedBestScore && projectedBestScore > score && (
        <div className="bg-gradient-to-r from-[#0a182d] via-[#0f2444] to-[#0c182b] border border-cyan-500/50 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-code font-bold uppercase tracking-wider text-cyan-300">
                  Counterfactual Takeover Planner (CTP)
                </span>
                <span className="text-[10px] font-mono-code bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800 text-cyan-300">
                  GREEDY CELF
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-100 mt-1">
                Do these 3 fixes → score{' '}
                <span className="font-mono-code text-amber-400">{score}</span> →{' '}
                <span className="font-mono-code text-emerald-400">
                  {projectedBestScore}
                </span>{' '}
                <span className="text-xs font-mono-code text-emerald-400 font-normal">
                  (+{projectedBestScore - score} pts)
                </span>
              </p>
            </div>
          </div>

          <Link
            to="/fixes"
            className="inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-xs font-mono-code transition-all shadow hover:shadow-[0_0_12px_rgba(6,182,212,0.5)] flex-shrink-0"
          >
            Open Fix Checklist <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
      {/* Error Banner with Retry */}
      {isAnalysisError && (
        <div className="p-4 bg-red-950/40 border border-red-800 rounded-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-200">Failed to load posture analysis</p>
              <p className="text-xs text-red-400/80">Unable to query /analysis endpoint telemetry.</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={() => refetchAnalysis()}>
            Retry Analysis
          </Button>
        </div>
      )}

      {/* Zero Accounts Empty State */}
      {!isAnalysisLoading && !isAnalysisError && totalAccounts === 0 && (
        <div className="p-6 bg-[#0c1220] border border-cyan-900/50 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-950/60 border border-cyan-800/80 rounded-lg text-cyan-400 flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold font-mono-code text-slate-100">Zero Registered Accounts in Inventory</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Load the standard 12-account cybersecurity persona or import your identity inventory to calculate attack graphs, recovery chokepoints, and blast radius.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              {seedMutation.isPending ? 'Seeding...' : 'Load Demo Persona'}
            </Button>
            <Link to="/accounts">
              <Button variant="outline" size="sm">
                Add Accounts
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Primary Posture Overview & Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Score & Headline Card */}
        <div
          className={`lg:col-span-4 rounded-lg border p-6 flex flex-col justify-between ${scoreTheme.bg}`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono-code uppercase tracking-wider text-slate-400">
                Audited Privacy Score
              </span>
              <span className="text-[10px] font-mono-code px-2 py-0.5 rounded border border-slate-700/60 bg-[#070b14] text-slate-300">
                {scoreTheme.label}
              </span>
            </div>

            {/* Radial SVG Instrument Gauge Display */}
            <div className="my-5 flex items-center justify-center">
              <div className="relative flex items-center justify-center">
                <svg className="w-36 h-36 transform -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx="72"
                    cy="72"
                    r={radius}
                    stroke="#162035"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {/* Value Arc */}
                  <circle
                    cx="72"
                    cy="72"
                    r={radius}
                    stroke={scoreTheme.stroke}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                {/* Score Number in Center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span
                    className={`text-4xl font-black font-mono-code tracking-tight ${scoreTheme.text}`}
                  >
                    {isAnalysisLoading ? '--' : score}
                  </span>
                  <span className="text-[10px] font-mono-code text-slate-400 mt-0.5">
                    / 100
                  </span>
                </div>
              </div>
            </div>

            {/* Headline Diagnostic */}
            <div className="bg-[#070c17]/90 border border-[#1c2638] rounded-md p-3">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-200 leading-relaxed font-mono-code">
                  {isAnalysisLoading ? (
                    <Skeleton className="h-4 w-full" />
                  ) : (
                    analysis?.headline
                  )}
                </div>
              </div>
            </div>

            {/* Required Caveat beneath headline */}
            <div className="text-[10px] text-slate-400 italic mt-2.5 font-mono-code text-center">
              Model-based estimate, not a measured probability.
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1c2638]/70 flex items-center justify-between text-[11px] text-slate-400 font-mono-code">
            <span>Expected Loss: <strong className="text-slate-200">{el.toFixed(1)}</strong></span>
            <span>Worst Case: <strong className="text-slate-200">{worst.toFixed(1)}</strong></span>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              label="Total Accounts"
              value={totalAccounts}
              subtext="Monitored digital inventory"
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
              label="Root SPOFs"
              value={spofCount}
              subtext="Single points of failure"
              trend={spofCount > 0 ? 'danger' : 'neutral'}
              icon={<AlertOctagon className="w-4 h-4 text-amber-400" />}
            />
            <Stat
              label="SIM Swap Blast"
              value={`${simSwapReachable} accts`}
              subtext="Vulnerable via carrier code"
              trend="danger"
              icon={<Smartphone className="w-4 h-4 text-red-400" />}
            />
          </div>

          {/* Riskiest Accounts Preview inside the KPI section */}
          <div className="bg-[#0d131f] border border-[#1c2638] rounded-lg p-4 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Top 5 Vulnerable Accounts
                </span>
                <span className="text-[10px] font-mono-code text-slate-400">
                  (Ordered by takeover probability desc)
                </span>
              </div>
              <Link
                to="/accounts"
                className="text-xs font-mono-code text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                All Accounts ({totalAccounts}) <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              {riskiestTop5.map((acct, idx) => (
                <div
                  key={acct.id}
                  onClick={() => openAccountDetail(acct.id)}
                  className="bg-[#080d18] hover:bg-[#111728] border border-[#1c2638] hover:border-cyan-800/80 p-2.5 rounded cursor-pointer transition-all duration-150 group"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-500 mb-1">
                    <span>#{idx + 1}</span>
                    <span>Imp {acct.impact}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-100 truncate group-hover:text-cyan-300 transition-colors">
                    {acct.name}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <BandBadge band={acct.band} probability={acct.p} size="sm" />
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
          <div className="h-64 flex items-center justify-center text-slate-500 font-mono-code text-xs">
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
        {snapshots && snapshots.length > 1 ? (
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
          <div className="h-40 flex flex-col items-center justify-center text-slate-500 font-mono-code text-xs space-y-1">
            <ShieldCheck className="w-8 h-8 text-slate-600 mb-1" />
            <p>Apply a fix to see your trend</p>
            <p className="text-[10px] text-slate-600">
              Each security remediation and account edit records a dated historical snapshot.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
