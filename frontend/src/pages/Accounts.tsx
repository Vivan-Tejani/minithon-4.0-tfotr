import React, { useState, useMemo, useEffect } from 'react'
import {
  useState_,
  useAnalysis,
  useUpdateAnchors,
  useUpsertAccount,
  useDeleteAccount,
  useSelection,
  useSeedDemo,
} from '../api/hooks'
import { Card, Button, BandBadge, Drawer, Skeleton } from '../components/ui'
import { FiltersBar, type FiltersState } from '../components/FiltersBar'
import { AccountForm } from '../components/AccountForm'
import type { Account } from '../api/types'
import {
  Plus,
  Trash2,
  Edit3,
  ShieldAlert,
  AlertCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react'

export const Accounts: React.FC = () => {
  useEffect(() => {
    document.title = 'Accounts & inventory · Chokepoint'
  }, [])

  const {
    data: appState,
    isLoading: isStateLoading,
    isError: isStateError,
    refetch: refetchState,
  } = useState_()
  const {
    data: analysis,
    isError: isAnalysisError,
    refetch: refetchAnalysis,
  } = useAnalysis()
  const { openAccountDetail } = useSelection()

  const updateAnchorsMutation = useUpdateAnchors()
  const upsertAccountMutation = useUpsertAccount()
  const deleteAccountMutation = useDeleteAccount()
  const seedMutation = useSeedDemo()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const [filters, setFilters] = useState<FiltersState>({
    search: '',
    band: 'all',
    serviceType: 'all',
    secondFactor: 'all',
    dataHeld: 'all',
    activityBucket: 'all',
    fallsIfCompromised: 'all',
  })

  const accounts = appState?.accounts ?? []
  const anchors = appState?.anchors ?? { phone: { sim_lock: false, device_lock: true } }

  const analysisMap = useMemo(() => {
    const map = new Map<string, { band: any; p: number }>()
    analysis?.accounts.forEach((a) => {
      map.set(a.id, { band: a.band, p: a.p })
    })
    return map
  }, [analysis])

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acct) => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const matchName = acct.name.toLowerCase().includes(q)
        const matchId = acct.id.toLowerCase().includes(q)
        const matchGroup = acct.password_group?.toLowerCase().includes(q)
        if (!matchName && !matchId && !matchGroup) return false
      }

      const an = analysisMap.get(acct.id)
      if (filters.band !== 'all' && an?.band !== filters.band) return false
      if (filters.serviceType !== 'all' && acct.type !== filters.serviceType) return false
      if (filters.secondFactor !== 'all' && acct.second_factor !== filters.secondFactor) return false

      if (filters.activityBucket !== 'all') {
        const diffDays =
          (new Date().getTime() - new Date(acct.last_activity).getTime()) /
          (1000 * 60 * 60 * 24)
        if (filters.activityBucket === 'recent' && diffDays > 90) return false
        if (filters.activityBucket === 'moderate' && (diffDays <= 90 || diffDays > 365)) return false
        if (filters.activityBucket === 'stale' && diffDays <= 365) return false
      }

      return true
    })
  }, [accounts, filters, analysisMap])

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-50">
            Accounts & inventory
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Tracking credential reuse, recovery gates, and blast-radius vectors across {accounts.length} services.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {accounts.length === 0 && (
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
            size="sm"
            onClick={() => {
              setEditingAccount(null)
              setIsFormOpen(true)
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add account
          </Button>
        </div>
      </div>

      {/* Error Banner with Retry */}
      {(isStateError || isAnalysisError) && (
        <Card className="border-red-500/20 bg-red-500/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">Failed to load inventory data</p>
                <p className="text-xs text-zinc-400">Unable to query backend state or analysis.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchState()
                refetchAnalysis()
              }}
            >
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Hardware & Anchor Baseline Card */}
      <Card
        title="Hardware & identity anchors"
        subtitle="Foundational device and carrier security controls"
      >
        {isStateLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-200">Carrier SIM lock / Port-out PIN</span>
                  {anchors.phone.sim_lock ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Enabled
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      Vulnerable
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Reduces SIM swap takeover probability across all SMS recovery gates.
                </p>
              </div>
              <input
                type="checkbox"
                checked={anchors.phone.sim_lock}
                onChange={(e) => {
                  updateAnchorsMutation.mutate({
                    phone: { ...anchors.phone, sim_lock: e.target.checked },
                  })
                }}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 cursor-pointer accent-zinc-100"
              />
            </div>

            <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-200">Device lock & biometrics</span>
                  {anchors.phone.device_lock ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Prevents physical access from granting SMS or Authenticator capabilities.
                </p>
              </div>
              <input
                type="checkbox"
                checked={anchors.phone.device_lock}
                onChange={(e) => {
                  updateAnchorsMutation.mutate({
                    phone: { ...anchors.phone, device_lock: e.target.checked },
                  })
                }}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 cursor-pointer accent-zinc-100"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Filters Bar */}
      <FiltersBar filters={filters} onChange={setFilters} />

      {/* Accounts Inventory Table */}
      <Card
        title={`Registered accounts (${filteredAccounts.length} / ${accounts.length})`}
        subtitle="Click any row to open credential details and blast-radius analysis"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="pb-3 pl-2 font-medium">Account</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">2FA gate</th>
                <th className="pb-3 font-medium">Password group</th>
                <th className="pb-3 font-medium">Risk status</th>
                <th className="pb-3 font-medium">Data stored</th>
                <th className="pb-3 font-medium">Last activity</th>
                <th className="pb-3 text-right pr-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {isStateLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-3 pl-2"><Skeleton className="h-4 w-28" /></td>
                    <td className="py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3"><Skeleton className="h-5 w-24" /></td>
                    <td className="py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3 pr-2 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500">
                    {accounts.length === 0 ? (
                      'No accounts in inventory.'
                    ) : (
                      <div className="space-y-2">
                        <p>No accounts match current filter criteria.</p>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setFilters({
                              search: '',
                              band: 'all',
                              serviceType: 'all',
                              secondFactor: 'all',
                              dataHeld: 'all',
                              activityBucket: 'all',
                              fallsIfCompromised: 'all',
                            })
                          }
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reset filters
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acct) => {
                  const an = analysisMap.get(acct.id)
                  return (
                    <tr
                      key={acct.id}
                      onClick={() => openAccountDetail(acct.id)}
                      className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 pl-2 font-medium text-zinc-200 flex items-center gap-2">
                        <span>{acct.name}</span>
                        {acct.breach_flag && (
                          <ShieldAlert className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        )}
                      </td>

                      <td className="py-3 text-zinc-400">{acct.type}</td>

                      <td className="py-3">
                        <span
                          className={
                            acct.second_factor === 'none'
                              ? 'text-red-400 font-medium'
                              : 'text-zinc-300'
                          }
                        >
                          {acct.second_factor}
                        </span>
                      </td>

                      <td className="py-3">
                        {acct.password_group ? (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
                            Group {acct.password_group}
                          </span>
                        ) : (
                          <span className="text-zinc-500">Unique</span>
                        )}
                      </td>

                      <td className="py-3">
                        {an ? (
                          <BandBadge band={an.band} probability={an.p} size="sm" />
                        ) : (
                          <span className="text-zinc-500">--</span>
                        )}
                      </td>

                      <td className="py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {acct.data_held.slice(0, 2).map((d) => (
                            <span
                              key={d}
                              className="text-[11px] px-2 py-0.5 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400"
                            >
                              {d}
                            </span>
                          ))}
                          {acct.data_held.length > 2 && (
                            <span className="text-[11px] text-zinc-500">
                              +{acct.data_held.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 text-zinc-400 font-mono-code text-[11px]">
                        {acct.last_activity}
                      </td>

                      <td
                        className="py-3 text-right pr-2 space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingAccount(acct)
                            setIsFormOpen(true)
                          }}
                          className="p-1 hover:text-zinc-100 text-zinc-400 rounded transition-colors"
                          title="Edit account"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete account ${acct.name}?`)) {
                              deleteAccountMutation.mutate(acct.id, {
                                onError: (err: any) => {
                                  alert(err?.message || `Cannot delete ${acct.name}: other accounts depend on it.`)
                                },
                              })
                            }
                          }}
                          className="p-1 hover:text-red-400 text-zinc-400 rounded transition-colors"
                          title="Delete account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Account Add/Edit Drawer */}
      <Drawer
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingAccount(null)
        }}
        title={editingAccount ? `Edit ${editingAccount.name}` : 'Add new account'}
        subtitle="Configure login methods, 2FA, and recovery routes"
        width="lg"
      >
        <AccountForm
          initialAccount={editingAccount}
          onSave={async (account, isNew) => {
            await upsertAccountMutation.mutateAsync({ account, isNew })
            setIsFormOpen(false)
            setEditingAccount(null)
          }}
          onCancel={() => {
            setIsFormOpen(false)
            setEditingAccount(null)
          }}
        />
      </Drawer>
    </div>
  )
}
