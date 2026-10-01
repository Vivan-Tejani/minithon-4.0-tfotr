import React, { useState, useEffect } from 'react'
import { Drawer, Button, Chip, useToast } from './ui'
import {
  getEndpointOverrides,
  setEndpointOverride,
  isUsingMock,
  setMasterMock,
  isMasterMockEnabled,
  onOverridesChange,
} from '../api/client'
import { useHealth, useSeedDemo, useResetState } from '../api/hooks'
import { useQueryClient } from '@tanstack/react-query'
import {
  Sliders,
  Server,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Database,
  Radio,
  RefreshCw,
} from 'lucide-react'

interface EndpointDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const ENDPOINTS: Array<{ key: string; name: string; path: string; owner: string }> = [
  { key: 'health', name: 'Service Health', path: '/health', owner: 'M1' },
  { key: 'state', name: 'Active Persona State', path: '/state', owner: 'M1' },
  { key: 'anchors', name: 'Anchor Controls', path: '/anchors', owner: 'M1' },
  { key: 'accounts', name: 'Account Inventory CRUD', path: '/accounts', owner: 'M1' },
  { key: 'analysis', name: 'Monte Carlo Analysis', path: '/analysis', owner: 'M2' },
  { key: 'paths', name: 'Attack Paths Generator', path: '/paths/:id', owner: 'M2' },
  { key: 'fixes', name: 'Fix Plan & Best-3', path: '/fixes', owner: 'M3' },
  { key: 'scenario', name: 'Attack Cascade Simulator', path: '/scenario', owner: 'M3' },
  { key: 'preview', name: 'Ghost Change Preview', path: '/preview', owner: 'M3' },
  { key: 'review', name: 'Security & Hygiene Review', path: '/review', owner: 'M3' },
  { key: 'snapshots', name: 'Posture Trend Snapshots', path: '/snapshots', owner: 'M1' },
  { key: 'events', name: 'Audit Telemetry Events', path: '/events', owner: 'M1' },
  { key: 'catalog', name: 'Service Provider Catalog', path: '/catalog', owner: 'M1' },
  { key: 'settings', name: 'Threat Engine Settings', path: '/settings', owner: 'M1' },
  { key: 'seed', name: 'Persona Seeding & Reset', path: '/seed/demo', owner: 'M1' },
]

export const EndpointDrawer: React.FC<EndpointDrawerProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { data: healthData, isError: isHealthError, isLoading: isHealthLoading, refetch: checkHealth } =
    useHealth()
  const seedMutation = useSeedDemo()
  const resetMutation = useResetState()

  const [overrides, setOverrides] = useState<Record<string, boolean>>(getEndpointOverrides())
  const [masterMock, setMasterMockState] = useState<boolean>(isMasterMockEnabled())

  useEffect(() => {
    return onOverridesChange(() => {
      setOverrides(getEndpointOverrides())
      setMasterMockState(isMasterMockEnabled())
    })
  }, [])

  const handleToggleEndpoint = (key: string) => {
    const currentForceReal = Boolean(overrides[key])
    const newForceReal = !currentForceReal
    setEndpointOverride(key, newForceReal)
    setOverrides(getEndpointOverrides())

    // Invalidate everything so current view updates to selected engine immediately
    queryClient.invalidateQueries()
    showToast(
      'Routing Switched',
      `Endpoint ${key} mapped to ${newForceReal ? 'LIVE API' : 'MOCK ENGINE'}`,
      'info'
    )
  }

  const handleToggleMasterMock = (useMock: boolean) => {
    setMasterMock(useMock)
    setMasterMockState(useMock)
    queryClient.invalidateQueries()
    showToast(
      'Global Mode Changed',
      useMock ? 'Master mode set to MOCK SIMULATION' : 'Master mode set to LIVE BACKEND API',
      useMock ? 'info' : 'success'
    )
  }

  const handleSeedDemo = async () => {
    try {
      await seedMutation.mutateAsync()
      showToast('Persona Loaded', 'Standard 12-account dataset populated', 'success')
    } catch (e: any) {
      showToast('Error Seeding Persona', e?.message, 'error')
    }
  }

  const handleResetEmpty = async () => {
    try {
      await resetMutation.mutateAsync()
      showToast('Reset Complete', 'Inventory cleared to empty state', 'warning')
    } catch (e: any) {
      showToast('Error Resetting', e?.message, 'error')
    }
  }

  const isBackendOnline = !isHealthError && healthData?.ok === true

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Data Layer & Endpoint Router"
      subtitle="Per-endpoint live API / mock simulation toggle matrix (M4-03)"
      width="lg"
    >
      <div className="space-y-6 text-slate-200">
        {/* Backend Status Telemetry */}
        <div className="p-4 rounded-lg bg-[#0d131f] border border-[#1d273a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono-code text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Backend API Status
                </span>
                <span className="text-[11px] font-mono-code text-slate-500">
                  (http://localhost:8000)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isHealthLoading
                  ? 'Pinging server health probe...'
                  : isBackendOnline
                  ? 'FastAPI server operational and accepting queries'
                  : 'FastAPI offline or unreachable. Using mock fallbacks.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold uppercase flex items-center gap-1.5 ${
                isBackendOnline
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                  : 'bg-red-950/80 text-red-400 border border-red-800'
              }`}
            >
              {isBackendOnline ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> ONLINE
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3" /> OFFLINE
                </>
              )}
            </span>
            <button
              onClick={() => checkHealth()}
              className="p-1 rounded bg-[#131b2e] hover:bg-[#1c2742] text-slate-400 hover:text-slate-200 border border-[#222e47] transition-all cursor-pointer"
              title="Ping backend"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Master Toggle Controls */}
        <div className="p-4 rounded-lg bg-[#0d131f] border border-[#1d273a] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
                Master Data Routing
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#080c14] p-1 rounded border border-[#1e2a40]">
              <button
                onClick={() => handleToggleMasterMock(true)}
                className={`px-3 py-1 rounded text-xs font-mono-code transition-all cursor-pointer ${
                  masterMock
                    ? 'bg-amber-950/70 text-amber-300 border border-amber-700/80 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MOCK DATASET
              </button>
              <button
                onClick={() => handleToggleMasterMock(false)}
                className={`px-3 py-1 rounded text-xs font-mono-code transition-all cursor-pointer ${
                  !masterMock
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/80 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                LIVE FASTAPI
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            When Master is set to <strong className="text-amber-300">Mock</strong>, all endpoints default to deterministic PRD §9 persona fixtures unless selectively forced live below.
          </p>
        </div>

        {/* Persona Management & Reset */}
        <div className="p-4 rounded-lg bg-[#0d131f] border border-[#1d273a] space-y-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
              State & Persona Controls
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedDemo}
              disabled={seedMutation.isPending}
              className="flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{seedMutation.isPending ? 'Seeding...' : 'Load Demo Persona (12 Accts)'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetEmpty}
              disabled={resetMutation.isPending}
              className="flex items-center justify-center gap-2 border-red-900/60 hover:border-red-700 text-red-300"
            >
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
              <span>{resetMutation.isPending ? 'Resetting...' : 'Reset to Empty Inventory'}</span>
            </Button>
          </div>
        </div>

        {/* Granular 15-Endpoint Toggle Matrix */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Per-Endpoint Switch Matrix
              </h3>
            </div>
            <span className="text-[11px] font-mono-code text-slate-400">
              15 Active Contract Shapes
            </span>
          </div>

          <div className="border border-[#1d273a] rounded-lg divide-y divide-[#182236] bg-[#090e1a] max-h-96 overflow-y-auto font-mono-code text-xs">
            {ENDPOINTS.map((ep) => {
              const activeMock = isUsingMock(ep.key)
              const forcedReal = Boolean(overrides[ep.key])

              return (
                <div
                  key={ep.key}
                  className="p-3 flex items-center justify-between hover:bg-[#0e1627] transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{ep.name}</span>
                      <Chip variant="default" size="sm" className="text-[9px] py-0 px-1.5">
                        {ep.owner}
                      </Chip>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-code">{ep.path}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        activeMock
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                          : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                      }`}
                    >
                      {activeMock ? 'MOCK' : 'LIVE'}
                    </span>

                    <button
                      onClick={() => handleToggleEndpoint(ep.key)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono-code transition-all cursor-pointer border ${
                        forcedReal
                          ? 'bg-cyan-950/70 border-cyan-600 text-cyan-300'
                          : 'bg-[#121a2c] border-[#222e47] text-slate-400 hover:text-slate-200 hover:bg-[#1a253e]'
                      }`}
                      title={forcedReal ? 'Forced to Real API' : 'Using default routing'}
                    >
                      {forcedReal ? 'FORCED LIVE' : 'USE DEFAULT'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Drawer>
  )
}
