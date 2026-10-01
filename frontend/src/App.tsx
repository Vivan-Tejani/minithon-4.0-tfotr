import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider, globalToast } from './components/ui'
import { SelectionProvider, GhostProvider } from './api/hooks'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Accounts } from './pages/Accounts'
import { Fixes } from './pages/Fixes'
import { Scenarios } from './pages/Scenarios'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: Error) => {
      globalToast.error('Network Error', error?.message || 'Failed to query endpoint telemetry')
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: Error) => {
      globalToast.error('Operation Failed', error?.message || 'Mutation failed to persist')
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SelectionProvider>
          <BrowserRouter>
            <GhostProvider>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="accounts" element={<Accounts />} />
                  <Route path="fixes" element={<Fixes />} />
                  <Route path="scenarios" element={<Scenarios />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </GhostProvider>
          </BrowserRouter>
        </SelectionProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
