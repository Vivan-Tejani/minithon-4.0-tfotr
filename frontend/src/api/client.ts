/**
 * Chokepoint API Client
 * Supports mock simulation and seamless per-endpoint real API flipping.
 * Strictly adheres to PRD §5 & §7 endpoints.
 */

import mockState from './mocks/state.json'
import mockAnalysis from './mocks/analysis.json'
import mockFixes from './mocks/fixes.json'
import mockSnapshots from './mocks/snapshots.json'
import mockEvents from './mocks/events.json'
import mockReview from './mocks/review.json'
import mockCatalog from './mocks/catalog.json'
import mockScenarioSimSwap from './mocks/scenario_sim_swap.json'
import mockPreview from './mocks/preview.json'
import type {
  Analysis,
  EventItem,
  FixPlan,
  ScenarioRequest,
  Snapshot,
  State,
} from './types'

// In-memory clone for stateful mock mutations
let currentMockState: State = JSON.parse(JSON.stringify(mockState)) as State
let currentMockSnapshots: Snapshot[] = JSON.parse(JSON.stringify(mockSnapshots)) as Snapshot[]
let currentMockEvents: EventItem[] = JSON.parse(JSON.stringify(mockEvents)) as EventItem[]
let currentMockAnalysis: Analysis = JSON.parse(JSON.stringify(mockAnalysis)) as Analysis
let currentMockFixes: FixPlan = JSON.parse(JSON.stringify(mockFixes)) as FixPlan

// Local storage key for persistent endpoint toggle overrides
const STORAGE_KEY = 'chokepoint_endpoint_overrides'
const MASTER_MOCK_KEY = 'chokepoint_use_mock_master'

function loadStoredOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fallback
  }
  return {
    health: false,
    state: false,
    anchors: false,
    accounts: false,
    catalog: false,
    seed: false,
    analysis: false,
    paths: false,
    fixes: false,
    preview: false,
    scenario: false,
    review: false,
    events: false,
    snapshots: false,
    settings: false,
  }
}

export const endpointOverrides: Record<string, boolean> = loadStoredOverrides()

export function getEndpointOverrides(): Record<string, boolean> {
  return { ...endpointOverrides }
}

type OverrideChangeListener = () => void
const overrideListeners = new Set<OverrideChangeListener>()

export function onOverridesChange(fn: OverrideChangeListener): () => void {
  overrideListeners.add(fn)
  return () => overrideListeners.delete(fn)
}

function notifyListeners() {
  overrideListeners.forEach((fn) => {
    try {
      fn()
    } catch {
      // ignore
    }
  })
}

export function setEndpointOverride(endpointKey: string, forceReal: boolean): void {
  endpointOverrides[endpointKey] = forceReal
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(endpointOverrides))
  } catch {
    // ignore
  }
  notifyListeners()
}

export function isUsingMock(endpointKey: string): boolean {
  try {
    const master = localStorage.getItem(MASTER_MOCK_KEY)
    if (master !== null) {
      if (master === 'false') return false
      if (endpointOverrides[endpointKey]) return false
      return true
    }
  } catch {
    // fallback
  }

  if (endpointOverrides[endpointKey]) return false
  return import.meta.env.VITE_USE_MOCK !== 'false'
}

export function isMasterMockEnabled(): boolean {
  try {
    const master = localStorage.getItem(MASTER_MOCK_KEY)
    if (master !== null) return master === 'true'
  } catch {
    // fallback
  }
  return import.meta.env.VITE_USE_MOCK !== 'false'
}

export function setMasterMock(useMock: boolean): void {
  try {
    localStorage.setItem(MASTER_MOCK_KEY, String(useMock))
  } catch {
    // ignore
  }
  notifyListeners()
}

export function resetMockData(): void {
  currentMockState = {
    anchors: { phone: { sim_lock: false, device_lock: true } },
    accounts: [],
    settings: JSON.parse(JSON.stringify(mockState.settings)),
    last_review_at: null,
    now: new Date().toISOString(),
  }
  currentMockAnalysis = {
    score: 100,
    el: 0,
    worst: 10,
    headline: 'No accounts registered. Add accounts to evaluate attack paths.',
    accounts: [],
    spofs: [],
    crown_path: null,
    graph: { nodes: [], edges: [] },
  }
  currentMockFixes = {
    base_score: 100,
    best3: [],
    quick_wins: [],
    plan: [],
  }
  currentMockSnapshots = [
    {
      id: 1,
      ts: new Date().toISOString(),
      score: 100,
      el: 0,
      label: 'Inventory Reset to Empty',
    },
  ]
}

const BASE_URL = '/api'

async function realFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    let errorDetail = res.statusText
    try {
      const errJson = await res.json()
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson)
    } catch {
      // ignore
    }
    throw new Error(`API Error [${res.status}] ${path}: ${errorDetail}`)
  }

  return (await res.json()) as T
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const cleanPath = path.split('?')[0]

    // Route mocks
    if (cleanPath === '/health') {
      if (!isUsingMock('health')) return realFetch<T>(path)
      return { ok: true } as unknown as T
    }

    if (cleanPath === '/state') {
      if (!isUsingMock('state')) return realFetch<T>(path)
      return currentMockState as unknown as T
    }

    if (cleanPath === '/analysis') {
      if (!isUsingMock('analysis')) return realFetch<T>(path)
      return currentMockAnalysis as unknown as T
    }

    if (cleanPath.startsWith('/paths/')) {
      if (!isUsingMock('paths')) return realFetch<T>(path)
      const acctId = cleanPath.replace('/paths/', '')
      const found = currentMockAnalysis.accounts.find((a) => a.id === acctId)
      return { paths: found?.top_paths ?? [] } as unknown as T
    }

    if (cleanPath === '/fixes') {
      if (!isUsingMock('fixes')) return realFetch<T>(path)
      return currentMockFixes as unknown as T
    }

    if (cleanPath === '/snapshots') {
      if (!isUsingMock('snapshots')) return realFetch<T>(path)
      return currentMockSnapshots as unknown as T
    }

    if (cleanPath === '/events') {
      if (!isUsingMock('events')) return realFetch<T>(path)
      return currentMockEvents as unknown as T
    }

    if (cleanPath === '/review') {
      if (!isUsingMock('review')) return realFetch<T>(path)
      return mockReview as unknown as T
    }

    if (cleanPath === '/catalog') {
      if (!isUsingMock('catalog')) return realFetch<T>(path)
      return mockCatalog as unknown as T
    }

    if (cleanPath === '/settings') {
      if (!isUsingMock('settings')) return realFetch<T>(path)
      return currentMockState.settings as unknown as T
    }

    return realFetch<T>(path)
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const cleanPath = path.split('?')[0]

    if (cleanPath === '/seed/demo') {
      if (!isUsingMock('seed')) return realFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
      currentMockState = JSON.parse(JSON.stringify(mockState)) as State
      currentMockAnalysis = JSON.parse(JSON.stringify(mockAnalysis)) as Analysis
      currentMockFixes = JSON.parse(JSON.stringify(mockFixes)) as FixPlan
      currentMockSnapshots = JSON.parse(JSON.stringify(mockSnapshots)) as Snapshot[]
      return { ok: true } as unknown as T
    }

    if (cleanPath === '/reset') {
      if (!isUsingMock('seed')) return realFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
      resetMockData()
      return { ok: true } as unknown as T
    }

    if (cleanPath === '/preview') {
      if (!isUsingMock('preview')) return realFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
      return mockPreview as unknown as T
    }

    if (cleanPath === '/scenario') {
      if (!isUsingMock('scenario')) return realFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
      const req = body as ScenarioRequest
      if (req?.target === 'E_SIM' || req?.kind === 'entry') {
        return mockScenarioSimSwap as unknown as T
      }
      return {
        ...mockScenarioSimSwap,
        scenario: { kind: req.kind, target: req.target, label: `Simulated Attack: ${req.target}` },
      } as unknown as T
    }

    if (cleanPath.startsWith('/fixes/') && cleanPath.endsWith('/apply')) {
      if (!isUsingMock('fixes')) return realFetch<T>(path, { method: 'POST' })
      const fixId = cleanPath.split('/')[2]
      const before = currentMockAnalysis.score
      const after = Math.min(100, before + 17)
      currentMockAnalysis.score = after
      currentMockSnapshots.push({
        id: currentMockSnapshots.length + 1,
        ts: new Date().toISOString(),
        score: after,
        el: Math.max(0, currentMockAnalysis.el - 4.5),
        label: `Applied: ${fixId}`,
      })
      currentMockEvents.unshift({
        id: currentMockEvents.length + 1,
        ts: new Date().toISOString(),
        kind: 'fix_applied',
        title: `Applied Security Remediation: ${fixId}`,
        detail_json: JSON.stringify({ score_before: before, score_after: after }),
      })
      return { score_before: before, score_after: after, state_version: 2 } as unknown as T
    }

    if (cleanPath === '/accounts') {
      if (!isUsingMock('accounts')) return realFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
      return body as unknown as T
    }

    if (cleanPath === '/review/complete') {
      if (!isUsingMock('review')) return realFetch<T>(path, { method: 'POST' })
      currentMockState.last_review_at = new Date().toISOString()
      return { ok: true } as unknown as T
    }

    return realFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const cleanPath = path.split('?')[0]

    if (cleanPath === '/anchors') {
      if (!isUsingMock('anchors')) return realFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) })
      currentMockState.anchors = body as State['anchors']
      return body as unknown as T
    }

    if (cleanPath.startsWith('/accounts/')) {
      if (!isUsingMock('accounts')) return realFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) })
      return body as unknown as T
    }

    if (cleanPath === '/settings') {
      if (!isUsingMock('settings')) return realFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) })
      currentMockState.settings = body as State['settings']
      return body as unknown as T
    }

    return realFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) })
  },

  async delete<T>(path: string): Promise<T> {
    const cleanPath = path.split('?')[0]

    if (cleanPath.startsWith('/accounts/')) {
      if (!isUsingMock('accounts')) return realFetch<T>(path, { method: 'DELETE' })
      const id = cleanPath.replace('/accounts/', '')
      currentMockState.accounts = currentMockState.accounts.filter((a) => a.id !== id)
      return { ok: true } as unknown as T
    }

    return realFetch<T>(path, { method: 'DELETE' })
  },
}
