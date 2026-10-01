/**
 * Domain and API response types for Chokepoint (matching PRD §5 & §7).
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
  | 'other';

export type SecondFactor = 'none' | 'sms' | 'authenticator' | 'hardware_key';
export type RiskBand = 'low' | 'medium' | 'high';
export type Effort = 'low' | 'medium' | 'high';

export interface AnchorPhone {
  sim_lock: boolean;
  device_lock: boolean;
}

export interface Anchors {
  phone: AnchorPhone;
}

export interface Account {
  id: string;
  name: string;
  service_key: string;
  type: AccountType | string;
  login_methods: string[];
  second_factor: SecondFactor | string;
  recovery: string[];
  password_group: string | null;
  permissions: string[];
  data_held: string[];
  last_activity: string;
  breach_flag: boolean;
  importance_override: number | null;
}

export interface CatalogEntry {
  key: string;
  name: string;
  type: string;
  login_methods_supported: string[];
  second_factors_supported: string[];
  recovery_bypasses_2fa: boolean;
  typical_permissions: string[];
  default_data_held: string[];
  breach_count_5y: number;
}

export interface Settings {
  horizon_years: number;
  p_sim: number;
  sim_lock_mult: number;
  p_phone: number;
  p_phish_email: number;
  leak_base: number;
  leak_per_breach: number;
  leak_cap: number;
  leak_flagged_min: number;
  trials: number;
  seed: number;
  band_low: number;
  band_high: number;
  stale_days: number;
  backup_email_stale_days: number;
}

export interface State {
  anchors: Anchors;
  accounts: Account[];
  settings: Settings;
  last_review_at: string | null;
  now: string;
}

export interface PathStep {
  node: string;
  hop: number;
  via: string;
}

export interface Path {
  entries: string[];
  steps: PathStep[];
  likelihood: number;
  band: RiskBand;
  cut_fix_id: string;
}

export interface AccountAnalysis {
  id: string;
  name: string;
  p: number;
  band: RiskBand;
  impact: number;
  why: string;
  reasons: string[];
  top_paths: Path[];
}

export interface SPOF {
  id: string;
  label: string;
  kind: 'entry' | 'group' | 'account' | string;
  falls: number;
  falls_ids: string[];
  d_el: number;
}

export interface ViewNode {
  id: string;
  label: string;
  kind: 'entry' | 'group' | 'account' | string;
  layer: number;
  p: number | null;
  band: RiskBand | string;
  impact: number;
  ghost?: boolean;
}

export interface ViewEdge {
  source: string;
  target: string;
  label: string;
  ghost?: boolean;
}

export interface GraphView {
  nodes: ViewNode[];
  edges: ViewEdge[];
}

export interface CrownPath {
  target: string;
  path: Path | null;
}

export interface Analysis {
  score: number;
  el: number;
  worst: number;
  headline: string;
  accounts: AccountAnalysis[];
  spofs: SPOF[];
  crown_path: CrownPath | null;
  graph: GraphView;
}

export interface Snapshot {
  id?: number;
  ts: string;
  score: number | null;
  el: number | null;
  label: string;
}

export interface EventItem {
  id: number;
  ts: string;
  kind: string;
  title: string;
  detail: any;
}

export interface PreviewRequest {
  op: 'upsert_account' | 'apply_fix';
  account?: Account;
  fix_id?: string;
}

export interface PreviewResponse {
  score_before: number;
  score_after: number;
  d_el: number;
  new_paths: Path[];
  new_spofs: SPOF[];
  ghost: GraphView;
}

export interface ScenarioRequest {
  kind: 'entry' | 'breach' | 'compromise';
  target: string;
}

export interface ScenarioRound {
  round: number;
  accounts: { id: string; via: string }[];
}

export interface ScenarioResponse {
  scenario: {
    kind: string;
    target: string;
    label: string;
  };
  cascade: ScenarioRound[];
  falls: number;
  el_delta: number;
  score_during: number;
  leaked_group: string | null;
  next_actions: any[];
}
