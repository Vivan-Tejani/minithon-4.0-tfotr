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
import {
  Card,
  Stat,
  BandBadge,
  Skeleton,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui'
import { Graph, type GraphRef } from '../components/Graph'
import { SpofPanel } from '../components/SpofPanel'
import { CrownPath } from '../components/CrownPath'
import { BaselineCompare } from '../components/BaselineCompare'
import {
  ShieldAlert,
  AlertOctagon,
  Layers,
  Sparkles,
  RotateCcw,
  Maximize2,
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
    document.title = 'Dashboard · Chokepoint'
  }, [])

  const {
    data: analysis,
    isLoading: isAnalysisLoading,
    isError: isAnalysisError,
    refetch: refetchAnalysis,
  } = useAnalysis()
  const { data: fixes } = useFixes()
  const { data: snapshots } = useSnapshots()
  const { openAccountDetail, ghostView } = useSelection()
  const applyFixMutation = useApplyFix()
  const seedMutation = useSeedDemo()
  const graphRef = useRef<GraphRef>(null)
  const fullGraphRef = useRef<GraphRef>(null)

  const handleSelectAccount = React.useCallback((id: string) => {
    openAccountDetail(id)
  }, [openAccountDetail])

  const score = analysis?.score ?? 0
  const el = analysis?.el ?? 0
  const worst = analysis?.worst ?? 1

  const totalAccounts = analysis?.accounts.length ?? 0
  const highRiskAccounts =
    analysis?.accounts.filter((a) => a.band === 'high').length ?? 0
  const spofCount = analysis?.spofs.length ?? 0

  const riskiestTop5 = [...(analysis?.accounts ?? [])]
    .sort((a, b) => b.p - a.p)
    .slice(0, 5)

  const best3Fixes = fixes?.plan.filter((f) => f.in_best3) ?? []
  const projectedBestScore =
    best3Fixes.length > 0 ? best3Fixes[best3Fixes.length - 1].score_after : null

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-50">
            Dashboard
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Privacy risk assessment, attack graph simulation, and remediation planning.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {totalAccounts === 0 && (
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchAnalysis()}
            disabled={isAnalysisLoading}
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isAnalysisLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Link to="/fixes">
            <Button size="sm">
              Fix checklist
            </Button>
          </Link>
        </div>
      </div>

      {/* Row of 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Score */}
        <Stat
          label="Posture score"
          value={
            <div className="flex items-baseline gap-2">
              <span>{isAnalysisLoading ? '--' : score}</span>
              <span className="text-xs font-normal text-zinc-400">/ 100</span>
            </div>
          }
          subtext={`Expected loss: ${el.toFixed(1)} · Worst case: ${worst.toFixed(1)}`}
        />

        {/* Card 2: Inventory */}
        <Stat
          label="Monitored accounts"
          value={totalAccounts}
          subtext="Total identity and service accounts"
          icon={<Layers className="w-4 h-4" />}
        />

        {/* Card 3: High Risk */}
        <Stat
          label="High-risk accounts"
          value={highRiskAccounts}
          subtext="Takeover likelihood 40% or higher"
          icon={<ShieldAlert className="w-4 h-4 text-red-400" />}
        />

        {/* Card 4: SPOFs */}
        <Stat
          label="Single points of failure"
          value={spofCount}
          subtext="Root vectors that compromise dependents"
          icon={<AlertOctagon className="w-4 h-4 text-amber-400" />}
        />
      </div>

      {/* Recommended Remediation: clean standard Card */}
      {projectedBestScore && projectedBestScore > score && (
        <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">
              Recommended remediation
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Resolving the top 3 recommended fixes can improve your score from{' '}
              <span className="font-semibold text-zinc-200">{score}</span> to{' '}
              <span className="font-semibold text-zinc-200">{projectedBestScore}</span> (+{projectedBestScore - score} points).
            </p>
          </div>
          <Link to="/fixes" className="flex-shrink-0">
            <Button size="sm">
              View fixes
            </Button>
          </Link>
        </Card>
      )}

      {/* Error state */}
      {isAnalysisError && (
        <Card className="border-red-500/20 bg-red-500/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-400">Failed to load posture analysis</p>
              <p className="text-xs text-zinc-400 mt-0.5">Could not fetch telemetry from the backend API.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchAnalysis()}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="graph">Attack graph</TabsTrigger>
          <TabsTrigger value="spofs">SPOFs</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          {/* Below stats: Graph (2/3 width) + Side column (1/3 width) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Graph Card: 2/3 width (8 cols) */}
            <div className="lg:col-span-8">
              <Card
                title="Attack graph"
                subtitle="Credential dependencies and recovery routes"
                action={
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => graphRef.current?.fit()}
                    className="text-xs text-zinc-400"
                  >
                    <Maximize2 className="w-3.5 h-3.5 mr-1" />
                    Fit
                  </Button>
                }
              >
                {isAnalysisLoading ? (
                  <Skeleton className="h-[480px] rounded-lg" />
                ) : analysis?.graph ? (
                  <Graph
                    ref={graphRef}
                    view={analysis.graph}
                    ghost={ghostView}
                    onSelect={handleSelectAccount}
                    height={480}
                  />
                ) : (
                  <div className="h-[480px] flex flex-col items-center justify-center text-xs text-zinc-500">
                    <p>No attack graph available</p>
                    <p className="text-[11px] text-zinc-600 mt-1">Add accounts or load the demo persona to view the graph.</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Side Column: 1/3 width (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Diagnostic Text */}
              <Card title="Diagnostic summary">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {isAnalysisLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    analysis?.headline || 'No diagnostic information available.'
                  )}
                </p>
                <p className="text-[11px] text-zinc-500 mt-3 pt-2 border-t border-zinc-800">
                  Model-based estimate, not a measured probability.
                </p>
              </Card>

              {/* Top Vulnerable Accounts */}
              <Card
                title="Top vulnerable accounts"
                subtitle="Accounts with highest takeover probability"
                action={
                  <Link to="/accounts" className="text-xs text-zinc-400 hover:text-zinc-200">
                    View all ({totalAccounts})
                  </Link>
                }
              >
                <div className="space-y-2">
                  {riskiestTop5.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-3 text-center">
                      No accounts registered.
                    </p>
                  ) : (
                    riskiestTop5.map((acct) => (
                      <div
                        key={acct.id}
                        onClick={() => openAccountDetail(acct.id)}
                        className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/50 cursor-pointer transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-200 truncate">
                            {acct.name}
                          </p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Impact: {acct.impact} / 10
                          </p>
                        </div>

                        <BandBadge band={acct.band} probability={acct.p} size="sm" />
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* SPOF & Crown jewel row */}
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

              <BaselineCompare
                compare={{
                  baseline_top3: [
                    { id: '2fa:netflix', title: 'Add 2FA to Netflix' },
                    { id: 'unique_pw:netflix', title: 'Change Netflix password' },
                    { id: '2fa:amazon', title: 'Add Authenticator 2FA to Amazon' },
                  ],
                  chokepoint_top3: [
                    { id: 'sim_lock', title: 'Turn on SIM lock (Carrier PIN)' },
                    { id: 'unique_pw:A', title: 'Separate Password Group A' },
                    { id: 'revoke:photoedit', title: 'Revoke Gmail token from Photo App' },
                  ],
                  baseline_score_after: 49,
                  chokepoint_score_after: 72,
                  divergence_explanation:
                    'Independent checkers recommend fixing single high-reuse nodes first; Chokepoint targets correlated root gates that cascade.',
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: ATTACK GRAPH */}
        <TabsContent value="graph">
          <Card
            title="Attack graph"
            subtitle="Full topology explorer"
            action={
              <Button
                variant="ghost"
                size="xs"
                onClick={() => fullGraphRef.current?.fit()}
                className="text-xs text-zinc-400"
              >
                <Maximize2 className="w-3.5 h-3.5 mr-1" />
                Fit view
              </Button>
            }
          >
            {isAnalysisLoading ? (
              <Skeleton className="h-[620px] rounded-lg" />
            ) : analysis?.graph ? (
              <Graph
                ref={fullGraphRef}
                view={analysis.graph}
                ghost={ghostView}
                onSelect={handleSelectAccount}
                height={620}
              />
            ) : (
              <div className="h-[620px] flex items-center justify-center text-xs text-zinc-500">
                No graph nodes generated.
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 3: SPOFS */}
        <TabsContent value="spofs" className="space-y-6">
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

              <BaselineCompare
                compare={{
                  baseline_top3: [
                    { id: '2fa:netflix', title: 'Add 2FA to Netflix' },
                    { id: 'unique_pw:netflix', title: 'Change Netflix password' },
                    { id: '2fa:amazon', title: 'Add Authenticator 2FA to Amazon' },
                  ],
                  chokepoint_top3: [
                    { id: 'sim_lock', title: 'Turn on SIM lock (Carrier PIN)' },
                    { id: 'unique_pw:A', title: 'Separate Password Group A' },
                    { id: 'revoke:photoedit', title: 'Revoke Gmail token from Photo App' },
                  ],
                  baseline_score_after: 49,
                  chokepoint_score_after: 72,
                  divergence_explanation:
                    'Independent checkers recommend fixing single high-reuse nodes first; Chokepoint targets correlated root gates that cascade.',
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: HISTORY */}
        <TabsContent value="history">
          <Card
            title="Posture score history"
            subtitle="Snapshot timeline of changes and remediation steps"
          >
            {snapshots && snapshots.length > 0 ? (
              <div className="space-y-6">
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={snapshots}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis
                        dataKey="ts"
                        stroke="#71717a"
                        fontSize={11}
                        tickFormatter={(val) => {
                          const d = new Date(val)
                          return `${d.getMonth() + 1}/${d.getDate()}`
                        }}
                      />
                      <YAxis
                        stroke="#71717a"
                        fontSize={11}
                        domain={[0, 100]}
                        tickCount={6}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-lg text-xs">
                                <p className="font-semibold text-zinc-100">
                                  Score: {data.score} / 100
                                </p>
                                <p className="text-zinc-400 mt-0.5">{data.label}</p>
                                <p className="text-zinc-500 text-[11px] mt-1">
                                  {new Date(data.ts).toLocaleDateString()}
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
                        stroke="#fafafa"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#09090b', stroke: '#fafafa', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#fafafa' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-4 py-2.5 font-medium">Event</th>
                        <th className="px-4 py-2.5 font-medium">Score</th>
                        <th className="px-4 py-2.5 font-medium">Expected loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {snapshots.map((snap, i) => (
                        <tr key={i} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="px-4 py-2.5 text-zinc-400">
                            {new Date(snap.ts).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-zinc-200">{snap.label}</td>
                          <td className="px-4 py-2.5 font-mono-code text-zinc-100">
                            {snap.score}
                          </td>
                          <td className="px-4 py-2.5 font-mono-code text-zinc-400">{snap.el}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-xs text-zinc-500">
                No historical snapshots recorded yet.
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
