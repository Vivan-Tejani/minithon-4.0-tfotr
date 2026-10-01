/**
 * React Query Hooks & API Data Layer
 * Strict adherence to PRD §7 endpoints and M4-03 specification.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  Account,
  Anchors,
  Analysis,
  CatalogEntry,
  EventItem,
  FixPlan,
  Path,
  Preview,
  PreviewRequest,
  ReviewResponse,
  Scenario,
  ScenarioRequest,
  Settings,
  Snapshot,
  State,
} from './types'

export { SelectionProvider, useSelection } from './SelectionContext'

// Queries
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ ok: boolean }>('/health'),
  })
}

export function useState_() {
  return useQuery<State>({
    queryKey: ['state'],
    queryFn: () => api.get<State>('/state'),
  })
}

export function useAnalysis() {
  return useQuery<Analysis>({
    queryKey: ['analysis'],
    queryFn: () => api.get<Analysis>('/analysis'),
  })
}

export function useFixes() {
  return useQuery<FixPlan>({
    queryKey: ['fixes'],
    queryFn: () => api.get<FixPlan>('/fixes'),
  })
}

export function usePaths(accountId: string | null) {
  return useQuery<{ paths: Path[] }>({
    queryKey: ['paths', accountId],
    queryFn: () => api.get<{ paths: Path[] }>(`/paths/${accountId}`),
    enabled: Boolean(accountId),
  })
}

export function useSnapshots() {
  return useQuery<Snapshot[]>({
    queryKey: ['snapshots'],
    queryFn: () => api.get<Snapshot[]>('/snapshots'),
  })
}

export function useEvents() {
  return useQuery<EventItem[]>({
    queryKey: ['events'],
    queryFn: () => api.get<EventItem[]>('/events'),
  })
}

export function useReview(asOf?: string) {
  return useQuery<ReviewResponse>({
    queryKey: ['review', asOf],
    queryFn: () => api.get<ReviewResponse>(asOf ? `/review?as_of=${asOf}` : '/review'),
  })
}

export function useCatalog() {
  return useQuery<CatalogEntry[]>({
    queryKey: ['catalog'],
    queryFn: () => api.get<CatalogEntry[]>('/catalog'),
  })
}

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
  })
}

// Mutations
export function useSeedDemo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/seed/demo'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['state'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
      queryClient.invalidateQueries({ queryKey: ['fixes'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['review'] })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export function useResetState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/reset'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['state'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
      queryClient.invalidateQueries({ queryKey: ['fixes'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['review'] })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: Settings) => api.put<Settings>('/settings', settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['state'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
      queryClient.invalidateQueries({ queryKey: ['fixes'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['review'] })
    },
  })
}

export function useUpdateAnchors() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (anchors: Anchors) => api.put<Anchors>('/anchors', anchors),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['state'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
      queryClient.invalidateQueries({ queryKey: ['fixes'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['review'] })
    },
  })
}

export function useUpsertAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ account, isNew }: { account: Account; isNew: boolean }) =>
      isNew
        ? api.post<Account>('/accounts', account)
        : api.put<Account>(`/accounts/${account.id}`, account),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['state'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
      queryClient.invalidateQueries({ queryKey: ['fixes'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['review'] })
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['state'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
      queryClient.invalidateQueries({ queryKey: ['fixes'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['review'] })
    },
  })
}

export function useApplyFix() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fixId: string) =>
      api.post<{ score_before: number; score_after: number; state_version: number }>(
        `/fixes/${fixId}/apply`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['state'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
      queryClient.invalidateQueries({ queryKey: ['fixes'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['review'] })
    },
  })
}

export function usePreview() {
  return useMutation({
    mutationFn: (req: PreviewRequest) => api.post<Preview>('/preview', req),
  })
}

export function useScenario() {
  return useMutation({
    mutationFn: (req: ScenarioRequest) => api.post<Scenario>('/scenario', req),
  })
}

export function useCompleteReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/review/complete'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review'] })
      queryClient.invalidateQueries({ queryKey: ['state'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
      queryClient.invalidateQueries({ queryKey: ['fixes'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
