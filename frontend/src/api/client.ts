import type {
  Account,
  Anchors,
  Analysis,
  CatalogEntry,
  PreviewRequest,
  PreviewResponse,
  ScenarioRequest,
  ScenarioResponse,
  Settings,
  Snapshot,
  State,
} from './types';

const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errMessage = `HTTP error ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        if (typeof errJson.detail === 'string') {
          errMessage = errJson.detail;
        } else if (Array.isArray(errJson.detail)) {
          errMessage = errJson.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
        }
      }
      if (errJson.dependents) {
        errMessage += `: ${errJson.dependents.join(', ')}`;
      }
    } catch {
      // ignore
    }
    const error = new Error(errMessage) as Error & { status: number; data?: any };
    error.status = res.status;
    throw error;
  }

  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<{ ok: boolean }>('/health'),
  getState: () => request<State>('/state'),
  getAnalysis: () => request<Analysis>('/analysis'),
  getCatalog: () => request<CatalogEntry[]>('/catalog'),
  getSettings: () => request<Settings>('/settings'),
  getSnapshots: () => request<Snapshot[]>('/snapshots'),

  updateAnchors: (anchors: Anchors) =>
    request<Anchors>('/anchors', {
      method: 'PUT',
      body: JSON.stringify(anchors),
    }),

  createAccount: (account: Partial<Account>) =>
    request<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    }),

  updateAccount: (id: string, account: Partial<Account>) =>
    request<Account>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(account),
    }),

  deleteAccount: (id: string) =>
    request<{ ok: boolean; deleted: string }>(`/accounts/${id}`, {
      method: 'DELETE',
    }),

  updateSettings: (settings: Settings) =>
    request<Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  seedDemo: () =>
    request<{ ok: boolean }>('/seed/demo', {
      method: 'POST',
    }),

  preview: (req: PreviewRequest) =>
    request<PreviewResponse>('/preview', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  runScenario: (req: ScenarioRequest) =>
    request<ScenarioResponse>('/scenario', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  exportState: () => request<any>('/export'),
  importState: (data: any) =>
    request<State>('/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
