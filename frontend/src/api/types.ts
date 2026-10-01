/**
 * Chokepoint Domain Models & API Types
 * Strictly mirrors PRD §5 and §7 specifications.
 */

export type AccountType =
  | 'email'
  | 'social'
  | 'shopping'
  | 'finance'
  | 'payments'
  | 'storage'
  | 'entertainment'
  | 'professional'
  | 'utility_app'
  | 'forum'
  | 'other'

export type SecondFactor = 'none' | 'sms' | 'authenticator' | 'hardware_key'

export type Effort = 'low' | 'medium' | 'high'

export type RiskBand = 'low' | 'medium' | 'high'

export interface Anchors {
  phone: {
    sim_lock: boolean
    device_lock: boolean
  }
}

export interface Account {
  id: string
  name: string
  service_key: string
  type: AccountType
  login_methods: string[]
  second_factor: SecondFactor
  recovery: string[]
  password_group: string | null
  permissions: string[]
  data_held: string[]
  last_activity: string
  breach_flag: boolean
  importance_override: number | null
}

export interface CatalogEntry {
  key: string
  name: string
  type: AccountType
  login_methods_supported: string[]
  second_factors_supported: SecondFactor[]
  recovery_bypasses_2fa: boolean
  typical_permissions: string[]
  default_data_held: string[]
  breach_count_5y: number
  _note?: string
}

export interface Settings {
  horizon_years: number
  p_sim: number
  sim_lock_mult: number
  p_phone: number
  p_phish_email: number
  leak_base: number
  leak_per_breach: number
  leak_cap: number
  leak_flagged_min: number
  trials: number
  seed: number
  band_low: number
  band_high: number
  stale_days: number
  backup_email_stale_days: number
}

export interface State {
  anchors: Anchors
  accounts: Account[]
  settings: Settings
  last_review_at: string | null
  now: string
}

export interface PathStep {
  node: string
  hop: number
  via: string
}

export interface Path {
  entries: string[]
  steps: PathStep[]
  likelihood: number
  band: RiskBand
  cut_fix_id: string
}

export interface GraphNode {
  id: string
  label: string
  kind: 'entry' | 'cap' | 'group' | 'account'
  layer: number
  p?: number | null
  band?: RiskBand | null
  impact?: number | null
  ghost?: boolean
}

export interface GraphEdge {
  source: string
  target: string
  label: string
  ghost?: boolean
}

export interface GraphView {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface SpofCandidate {
  id: string
  label: string
  kind: 'entry' | 'group' | 'account'
  falls: number
  falls_ids: string[]
  d_el: number
}

export interface AccountAnalysis {
  id: string
  name: string
  p: number
  band: RiskBand
  impact: number
  why: string
  reasons: string[]
  top_paths: Path[]
}

export interface Analysis {
  score: number
  el: number
  worst: number
  headline: string
  accounts: AccountAnalysis[]
  spofs: SpofCandidate[]
  crown_path: {
    target: string
    path: Path
  } | null
  graph: GraphView
}

export interface Fix {
  id: string
  type: string
  title: string
  target: string
  effort: Effort
  standalone_gain: number
  marginal_gain: number
  score_after: number
  rank: number
  in_best3: boolean
  greedy?: boolean
  note?: string
  why: string
}

export interface FixPlan {
  plan: Fix[]
  best3: string[]
  quick_wins: string[]
  base_score: number
}

export type PreviewRequest =
  | { op: 'upsert_account'; account: Account }
  | { op: 'apply_fix'; fix_id: string }

export interface Preview {
  score_before: number
  score_after: number
  d_el: number
  new_paths: Path[]
  new_spofs: SpofCandidate[]
  ghost: GraphView
}

export interface ScenarioRequest {
  kind: 'entry' | 'breach' | 'compromise'
  target: string
}

export interface ScenarioCascadeAccount {
  id: string
  via: string
}

export interface ScenarioCascadeRound {
  round: number
  accounts: ScenarioCascadeAccount[]
}

export interface Scenario {
  scenario: {
    kind: string
    target: string
    label: string
  }
  cascade: ScenarioCascadeRound[]
  falls: number
  el_delta: number
  score_during: number
  leaked_group: string | null
  next_actions: Fix[]
}

export interface ReviewItem {
  id: string
  kind: 'stale_account' | 'unused_backup_email' | 'weak_2fa' | 'reuse' | 'periodic_review'
  target: string
  title: string
  detail: string
  severity: 'low' | 'medium' | 'high'
  fix_id: string | null
}

export interface ReviewResponse {
  as_of: string
  items: ReviewItem[]
}

export interface Snapshot {
  id?: number
  ts: string
  score: number
  el: number
  label: string
}

export interface EventItem {
  id?: number
  ts: string
  kind: string
  title: string
  detail_json?: string
}

export interface CompareResult {
  baseline_top3: Array<{ id: string; title: string }>
  chokepoint_top3: Array<{ id: string; title: string }>
  baseline_score_after: number
  chokepoint_score_after: number
  divergence_explanation: string
}
