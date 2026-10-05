import React from 'react'
import type { RiskBand, AccountType, SecondFactor } from '../api/types'
import { Search } from 'lucide-react'

export interface FiltersState {
  search: string
  band: RiskBand | 'all'
  serviceType: AccountType | 'all'
  secondFactor: SecondFactor | 'all'
  dataHeld: string | 'all'
  activityBucket: 'all' | 'recent' | 'moderate' | 'stale'
  fallsIfCompromised: string | 'all'
}

export interface FiltersBarProps {
  filters: FiltersState
  onChange: (filters: FiltersState) => void
  compromiseOptions?: Array<{ id: string; label: string }>
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  filters,
  onChange,
  compromiseOptions = [],
}) => {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
      {/* Search and Primary Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search accounts by name, ID, or password group..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Risk Band */}
        <div>
          <select
            value={filters.band}
            onChange={(e) => onChange({ ...filters, band: e.target.value as RiskBand | 'all' })}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            <option value="all">All risk levels</option>
            <option value="high">High risk (≥40%)</option>
            <option value="medium">Medium risk (15–39%)</option>
            <option value="low">Low risk (&lt;15%)</option>
          </select>
        </div>

        {/* 2FA Method */}
        <div>
          <select
            value={filters.secondFactor}
            onChange={(e) =>
              onChange({ ...filters, secondFactor: e.target.value as SecondFactor | 'all' })
            }
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
          >
            <option value="all">All 2FA methods</option>
            <option value="none">No 2FA</option>
            <option value="sms">SMS OTP</option>
            <option value="authenticator">Authenticator app</option>
            <option value="hardware_key">Hardware key</option>
          </select>
        </div>
      </div>

      {/* Secondary Filter Row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-zinc-800/80 text-xs">
        <span className="text-zinc-500 text-xs">Filter by:</span>

        {/* Service Type */}
        <select
          value={filters.serviceType}
          onChange={(e) =>
            onChange({ ...filters, serviceType: e.target.value as AccountType | 'all' })
          }
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-300 focus:outline-none text-xs"
        >
          <option value="all">All service types</option>
          <option value="email">Email</option>
          <option value="shopping">Shopping</option>
          <option value="finance">Finance</option>
          <option value="payments">Payments</option>
          <option value="storage">Storage</option>
          <option value="social">Social</option>
          <option value="utility_app">Utility app</option>
          <option value="forum">Forum</option>
        </select>

        {/* Activity Bucket */}
        <select
          value={filters.activityBucket}
          onChange={(e) =>
            onChange({
              ...filters,
              activityBucket: e.target.value as FiltersState['activityBucket'],
            })
          }
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-300 focus:outline-none text-xs"
        >
          <option value="all">All activity</option>
          <option value="recent">Recent (&lt; 90 days)</option>
          <option value="moderate">Moderate (90–365 days)</option>
          <option value="stale">Stale (&gt; 365 days)</option>
        </select>

        {/* Falls if compromised dropdown */}
        {compromiseOptions.length > 0 && (
          <select
            value={filters.fallsIfCompromised}
            onChange={(e) => onChange({ ...filters, fallsIfCompromised: e.target.value })}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-300 focus:outline-none text-xs"
          >
            <option value="all">Falls if compromised (off)</option>
            {compromiseOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {(filters.search ||
          filters.band !== 'all' ||
          filters.serviceType !== 'all' ||
          filters.secondFactor !== 'all' ||
          filters.activityBucket !== 'all' ||
          filters.fallsIfCompromised !== 'all') && (
          <button
            onClick={() =>
              onChange({
                search: '',
                band: 'all',
                serviceType: 'all',
                secondFactor: 'all',
                dataHeld: 'all',
                activityBucket: 'all',
                fallsIfCompromised: 'all',
              })
            }
            className="text-zinc-400 hover:text-zinc-100 text-xs ml-auto cursor-pointer"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  )
}
