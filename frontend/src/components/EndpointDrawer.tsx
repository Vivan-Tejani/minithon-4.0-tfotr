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
      title="Data layer & endpoint router"
      subtitle="Per-endpoint live API and mock simulation toggle matrix"
      width="lg"
    >
      <div className="space-y-6 text-zinc-200">
        {/* Backend Status Telemetry */}
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-4 h-4 text-zinc-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  Backend API status
                </span>
                <span className="text-xs font-mono text-zinc-500">
                  (http://localhost:8000)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
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
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                isBackendOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {isBackendOnline ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Online
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3" /> Offline
                </>
              )}
            </span>
            <button
              onClick={() => checkHealth()}
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-700/60 transition-colors cursor-pointer"
              title="Ping backend"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Master Toggle Controls */}
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-200">
                Master data routing
              </span>
            </div>
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => handleToggleMasterMock(true)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  masterMock
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Mock dataset
              </button>
              <button
                onClick={() => handleToggleMasterMock(false)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  !masterMock
                    ? 'bg-zinc-100 text-zinc-900 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Live FastAPI
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            When Master is set to <strong className="text-zinc-200 font-medium">Mock</strong>, all endpoints default to deterministic PRD persona fixtures unless selectively forced live below.
          </p>
        </div>

        {/* Persona Management & Reset */}
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-200">
              State & persona controls
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
              <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
              <span>{seedMutation.isPending ? 'Seeding...' : 'Load demo persona (12 accounts)'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetEmpty}
              disabled={resetMutation.isPending}
              className="flex items-center justify-center gap-2 border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
              <span>{resetMutation.isPending ? 'Resetting...' : 'Reset to empty inventory'}</span>
            </Button>
          </div>
        </div>

        {/* Granular 15-Endpoint Toggle Matrix */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-medium text-zinc-200">
                Per-endpoint switch matrix
              </h3>
            </div>
            <span className="text-xs font-mono text-zinc-500">
              15 active contract shapes
            </span>
          </div>

          <div className="border border-zinc-800 rounded-xl divide-y divide-zinc-800/70 bg-zinc-950/60 max-h-96 overflow-y-auto text-xs">
            {ENDPOINTS.map((ep) => {
              const activeMock = isUsingMock(ep.key)
              const forcedReal = Boolean(overrides[ep.key])

              return (
                <div
                  key={ep.key}
                  className="p-3 flex items-center justify-between hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-200">{ep.name}</span>
                      <Chip variant="default" size="xs">
                        {ep.owner}
                      </Chip>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono">{ep.path}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        activeMock
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {activeMock ? 'Mock' : 'Live'}
                    </span>

                    <button
                      onClick={() => handleToggleEndpoint(ep.key)}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer border ${
                        forcedReal
                          ? 'bg-zinc-100 border-zinc-100 text-zinc-900 font-medium'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                      title={forcedReal ? 'Forced to Real API' : 'Using default routing'}
                    >
                      {forcedReal ? 'Forced live' : 'Use default'}
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
