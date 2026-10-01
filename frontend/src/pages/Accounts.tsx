import React, { useState, useMemo } from 'react'
import { useState_, useAnalysis, useUpdateAnchors, useUpsertAccount, useDeleteAccount, useSelection } from '../api/hooks'
import { Card, Button, Chip, BandBadge, Drawer } from '../components/ui'
import { FiltersBar, type FiltersState } from '../components/FiltersBar'
import { AccountForm } from '../components/AccountForm'
import type { Account } from '../api/types'
import { Plus, Smartphone, Trash2, Edit3, ShieldAlert } from 'lucide-react'

export const Accounts: React.FC = () => {
  const { data: appState } = useState_()
  const { data: analysis } = useAnalysis()
  const { openAccountDetail } = useSelection()

  const updateAnchorsMutation = useUpdateAnchors()
  const upsertAccountMutation = useUpsertAccount()
  const deleteAccountMutation = useDeleteAccount()

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
      {/* Header and Anchors Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-mono-code uppercase tracking-wide text-slate-100">
            Account & App Inventory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tracking credential reuse, recovery gates, and blast-radius vectors across {accounts.length} services.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditingAccount(null)
            setIsFormOpen(true)
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          Add Account
        </Button>
      </div>

      {/* Hardware & Anchor Baseline Card */}
      <Card
        title="Hardware & Identity Anchors"
        subtitle="Foundational device and SIM carrier barriers affecting all downstream gates"
        action={<Smartphone className="w-4 h-4 text-cyan-400" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 bg-[#0a0f1d] border border-[#1c2638] rounded-lg flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">Carrier SIM Lock / Port-Out PIN</span>
                {anchors.phone.sim_lock ? (
                  <Chip variant="success" size="xs">ENABLED</Chip>
                ) : (
                  <Chip variant="danger" size="xs">VULNERABLE</Chip>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Multiplies SIM swap takeover probability by 0.25× across all SMS gates.
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
              className="h-4 w-4 rounded bg-[#070b14] border-[#1c2638] text-cyan-500 cursor-pointer"
            />
          </div>

          <div className="p-3.5 bg-[#0a0f1d] border border-[#1c2638] rounded-lg flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">Device Lock / Biometrics</span>
                {anchors.phone.device_lock ? (
                  <Chip variant="success" size="xs">ACTIVE</Chip>
                ) : (
                  <Chip variant="danger" size="xs">DISABLED</Chip>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Blocks physical device access from granting SMS or Authenticator capabilities.
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
              className="h-4 w-4 rounded bg-[#070b14] border-[#1c2638] text-cyan-500 cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* Filters Bar */}
      <FiltersBar filters={filters} onChange={setFilters} />

      {/* Accounts Inventory Table */}
      <Card
        title={`Registered Accounts (${filteredAccounts.length} / ${accounts.length})`}
        subtitle="Click any row to open full attack path and blast-radius telemetry"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1c2638] text-slate-400 uppercase font-mono-code text-[11px]">
                <th className="pb-3 pl-2">Account</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">2FA Gate</th>
                <th className="pb-3">Password Group</th>
                <th className="pb-3">Audited Risk Band</th>
                <th className="pb-3">Data / Access</th>
                <th className="pb-3">Last Activity</th>
                <th className="pb-3 text-right pr-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c2638]/50">
              {filteredAccounts.map((acct) => {
                const an = analysisMap.get(acct.id)
                return (
                  <tr
                    key={acct.id}
                    onClick={() => openAccountDetail(acct.id)}
                    className="hover:bg-[#111728] transition-colors cursor-pointer group"
                  >
                    <td className="py-3 pl-2 font-medium text-slate-100 flex items-center gap-2">
                      <span>{acct.name}</span>
                      {acct.breach_flag && (
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      )}
                    </td>

                    <td className="py-3 text-slate-400 font-mono-code">{acct.type}</td>

                    <td className="py-3 font-mono-code">
                      <span
                        className={
                          acct.second_factor === 'none'
                            ? 'text-red-400 font-semibold'
                            : 'text-slate-300'
                        }
                      >
                        {acct.second_factor}
                      </span>
                    </td>

                    <td className="py-3 font-mono-code">
                      {acct.password_group ? (
                        <Chip variant="warning" size="xs">
                          Group {acct.password_group}
                        </Chip>
                      ) : (
                        <span className="text-slate-500 italic">Unique</span>
                      )}
                    </td>

                    <td className="py-3">
                      {an ? (
                        <BandBadge band={an.band} probability={an.p} size="sm" />
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    <td className="py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {acct.data_held.slice(0, 2).map((d) => (
                          <Chip key={d} size="xs" variant="default">
                            {d}
                          </Chip>
                        ))}
                        {acct.data_held.length > 2 && (
                          <span className="text-[10px] text-slate-500 font-mono-code">
                            +{acct.data_held.length - 2}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 font-mono-code text-slate-400">
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
                        className="p-1 hover:text-cyan-400 text-slate-400 rounded transition-colors"
                        title="Edit Account"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete account ${acct.name}?`)) {
                            deleteAccountMutation.mutate(acct.id)
                          }
                        }}
                        className="p-1 hover:text-red-400 text-slate-400 rounded transition-colors"
                        title="Delete Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
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
        title={editingAccount ? `Edit ${editingAccount.name}` : 'Add New Account'}
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
