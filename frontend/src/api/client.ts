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
  ReviewItem,
  ReviewResponse,
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
let currentMockReview: ReviewResponse = JSON.parse(JSON.stringify(mockReview)) as ReviewResponse

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

  // In production builds, default to real API unless explicitly overridden by VITE_USE_MOCK === 'true'
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_USE_MOCK === 'true'
  }
  return import.meta.env.VITE_USE_MOCK !== 'false'
}

export function isMasterMockEnabled(): boolean {
  try {
    const master = localStorage.getItem(MASTER_MOCK_KEY)
    if (master !== null) return master === 'true'
  } catch {
    // fallback
  }
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_USE_MOCK === 'true'
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
  currentMockReview = {
    as_of: new Date().toISOString(),
    items: [],
  }
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

      const urlParams = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '')
      const asOf = urlParams.get('as_of')
      const targetDate = asOf ? new Date(asOf) : new Date()

      let items = [...currentMockReview.items]
      const lastReview = currentMockState.last_review_at ? new Date(currentMockState.last_review_at) : null
      const daysSinceReview = lastReview
        ? (targetDate.getTime() - lastReview.getTime()) / (1000 * 3600 * 24)
        : 999

      if (daysSinceReview >= 30) {
        if (!items.some((i) => i.kind === 'periodic_review')) {
          items.push({
            id: 'periodic_review:global',
            kind: 'periodic_review',
            target: 'system',
            title: 'Quarterly Digital Footprint Audit Due',
            detail: `Digital inventory has not undergone a full scheduled security audit in ${Math.round(
              daysSinceReview
            )} days.`,
            severity: 'low',
            fix_id: null,
          })
        }
      } else {
        items = items.filter((i) => i.kind !== 'periodic_review')
      }

      return {
        as_of: asOf || new Date().toISOString().split('T')[0],
        items,
      } as unknown as T
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
      currentMockReview = JSON.parse(JSON.stringify(mockReview)) as ReviewResponse
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

      if (req?.target === 'E_SIM' || (req?.kind === 'entry' && req?.target === 'E_SIM')) {
        return mockScenarioSimSwap as unknown as T
      }

      if (req?.kind === 'entry' && req?.target === 'E_PHONE') {
        const deviceLockActive = currentMockState.anchors.phone.device_lock
        if (deviceLockActive) {
          return {
            scenario: {
              kind: 'entry',
              target: 'E_PHONE',
              label: 'Lost / Stolen Phone (Device Lock Active)',
            },
            cascade: [],
            falls: 0,
            el_delta: 0,
            score_during: currentMockAnalysis.score,
            leaked_group: null,
            next_actions: [],
          } as unknown as T
        } else {
          return {
            scenario: {
              kind: 'entry',
              target: 'E_PHONE',
              label: 'Lost / Stolen Phone (Unlocked Device)',
            },
            cascade: [
              {
                round: 1,
                accounts: [
                  { id: 'upi', via: 'Direct biometric/passcode bypass' },
                  { id: 'gmail', via: 'Active cached session on device' },
                ],
              },
            ],
            falls: 2,
            el_delta: 6.8,
            score_during: 18,
            leaked_group: null,
            next_actions: [
              {
                id: 'device_lock',
                type: 'device_lock',
                title: 'Enable strong device lock PIN / biometric encryption',
                target: 'phone',
                effort: 'low',
                standalone_gain: 6.8,
                marginal_gain: 6.8,
                score_after: currentMockAnalysis.score + 15,
                rank: 1,
                in_best3: true,
                note: 'Locks stolen device instantly.',
                why: 'Prevents direct physical access from extracting cached session keys.',
              },
            ],
          } as unknown as T
        }
      }

      if (req?.kind === 'breach') {
        const targetAcct = currentMockState.accounts.find((a) => a.id === req.target)
        const pwGroup = targetAcct?.password_group
        const matchingGroupAccounts = pwGroup
          ? currentMockState.accounts.filter((a) => a.password_group === pwGroup && a.id !== req.target)
          : []

        const round1 = [{ id: req.target, via: 'Initial credential breach / leaked hash' }]
        const round2 = matchingGroupAccounts.map((a) => ({
          id: a.id,
          via: `Credential stuffing via reused password group '${pwGroup}'`,
        }))

        const totalFalls = round1.length + round2.length
        return {
          scenario: {
            kind: 'breach',
            target: req.target,
            label: `Service Credential Leak (${targetAcct?.name || req.target})`,
          },
          cascade: round2.length > 0 ? [{ round: 1, accounts: round1 }, { round: 2, accounts: round2 }] : [{ round: 1, accounts: round1 }],
          falls: totalFalls,
          el_delta: Math.round(totalFalls * 1.4 * 10) / 10,
          score_during: Math.max(8, currentMockAnalysis.score - totalFalls * 7),
          leaked_group: pwGroup || null,
          next_actions: pwGroup
            ? [
                {
                  id: `unique_pw:${pwGroup}`,
                  type: 'unique_pw',
                  title: `Assign unique passwords to accounts in Group '${pwGroup}'`,
                  target: pwGroup,
                  effort: 'medium',
                  standalone_gain: 4.8,
                  marginal_gain: 4.8,
                  score_after: currentMockAnalysis.score + 14,
                  rank: 1,
                  in_best3: true,
                  note: 'Isolates password reuse breach cascade.',
                  why: 'Ensures a breach at one service cannot unlock any other accounts.',
                },
              ]
            : [],
        } as unknown as T
      }

      if (req?.kind === 'compromise') {
        const targetAcct = currentMockState.accounts.find((a) => a.id === req.target)
        // Find accounts that use this account as SSO or recovery
        const dependents = currentMockState.accounts.filter(
          (a) =>
            a.id !== req.target &&
            (a.login_methods?.some((m) => m.includes(req.target)) || a.recovery?.some((r) => r.includes(req.target)))
        )

        const round1 = [{ id: req.target, via: 'Direct account takeover / session hijack' }]
        const round2 = dependents.map((a) => ({
          id: a.id,
          via: `Identity federation & password recovery via ${targetAcct?.name || req.target}`,
        }))

        const totalFalls = round1.length + round2.length
        return {
          scenario: {
            kind: 'compromise',
            target: req.target,
            label: `Direct Hijack of ${targetAcct?.name || req.target}`,
          },
          cascade: round2.length > 0 ? [{ round: 1, accounts: round1 }, { round: 2, accounts: round2 }] : [{ round: 1, accounts: round1 }],
          falls: totalFalls,
          el_delta: Math.round(totalFalls * 1.5 * 10) / 10,
          score_during: Math.max(5, currentMockAnalysis.score - totalFalls * 8),
          leaked_group: null,
          next_actions: [
            {
              id: `2fa:${req.target}`,
              type: '2fa',
              title: `Enforce hardware or app authenticator 2FA on ${targetAcct?.name || req.target}`,
              target: req.target,
              effort: 'low',
              standalone_gain: 3.5,
              marginal_gain: 3.5,
              score_after: currentMockAnalysis.score + 12,
              rank: 1,
              in_best3: true,
              note: 'Blocks unauthorized takeover at source.',
              why: 'Multi-factor authentication invalidates stolen credentials.',
            },
          ],
        } as unknown as T
      }

      return mockScenarioSimSwap as unknown as T
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
      currentMockReview.items = currentMockReview.items.filter((item: ReviewItem) => item.fix_id !== fixId)
      return { score_before: before, score_after: after, state_version: 2 } as unknown as T
    }

    if (cleanPath === '/accounts') {
      if (!isUsingMock('accounts')) return realFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
      return body as unknown as T
    }

    if (cleanPath === '/review/complete') {
      if (!isUsingMock('review')) return realFetch<T>(path, { method: 'POST' })
      currentMockState.last_review_at = new Date().toISOString()
      currentMockReview.items = currentMockReview.items.filter((item: ReviewItem) => item.kind !== 'periodic_review')
      return { ok: true, last_review_at: currentMockState.last_review_at } as unknown as T
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
