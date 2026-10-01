import React, { useState } from 'react';
import { Search, Filter, ShieldAlert, X } from 'lucide-react';
import type { Account } from '../api/types';

export interface FilterState {
  search: string;
  band: string;
  type: string;
  dataHeld: string;
  secondFactor: string;
  activityBucket: string;
  fallsIfTarget: string; // e.g. "entry:E_SIM", "entry:E_PHONE", "compromise:gmail", "breach:A"
}

interface FiltersBarProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  accounts: Account[];
  scenarioAffectedIds?: Set<string>;
  onScenarioFilterChange?: (target: string) => void;
  isScenarioLoading?: boolean;
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  filters,
  onChange,
  accounts,
  scenarioAffectedIds,
  onScenarioFilterChange,
  isScenarioLoading,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const emailAccounts = accounts.filter((a) => a.type === 'email');
  const passwordGroups = Array.from(
    new Set(accounts.map((a) => a.password_group).filter(Boolean))
  ) as string[];

  const handleReset = () => {
    onChange({
      search: '',
      band: 'ALL',
      type: 'ALL',
      dataHeld: 'ALL',
      secondFactor: 'ALL',
      activityBucket: 'ALL',
      fallsIfTarget: 'NONE',
    });
    if (onScenarioFilterChange) {
      onScenarioFilterChange('NONE');
    }
  };

  const hasActiveFilters =
    filters.search !== '' ||
    filters.band !== 'ALL' ||
    filters.type !== 'ALL' ||
    filters.dataHeld !== 'ALL' ||
    filters.secondFactor !== 'ALL' ||
    filters.activityBucket !== 'ALL' ||
    filters.fallsIfTarget !== 'NONE';

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg backdrop-blur-sm">
      {/* Top Search & Primary Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search accounts by name, ID, or service..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* Risk Band Select */}
        <select
          value={filters.band}
          onChange={(e) => onChange({ ...filters, band: e.target.value })}
          className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
        >
          <option value="ALL">All Risk Bands</option>
          <option value="high">High Risk (≥ 40%)</option>
          <option value="medium">Medium Risk (15–40%)</option>
          <option value="low">Low Risk (&lt; 15%)</option>
        </select>

        {/* "Falls if compromised" scenario filter */}
        <div className="relative">
          <select
            value={filters.fallsIfTarget}
            onChange={(e) => {
              const val = e.target.value;
              onChange({ ...filters, fallsIfTarget: val });
              if (onScenarioFilterChange) onScenarioFilterChange(val);
            }}
            className={`rounded-lg border px-3 py-2 text-xs focus:outline-none transition-colors ${
              filters.fallsIfTarget !== 'NONE'
                ? 'border-rose-500/50 bg-rose-950/40 text-rose-300'
                : 'border-slate-800 bg-slate-950/80 text-slate-300 focus:border-cyan-500'
            }`}
          >
            <option value="NONE">Falls if ... is compromised</option>
            <optgroup label="Threat Entry Points">
              <option value="entry:E_SIM">SIM Swap (Phone Number)</option>
              <option value="entry:E_PHONE">Lost / Stolen Phone</option>
            </optgroup>
            {emailAccounts.length > 0 && (
              <optgroup label="Email Hub Accounts">
                {emailAccounts.map((ea) => (
                  <option key={ea.id} value={`compromise:${ea.id}`}>
                    {ea.name} Compromised
                  </option>
                ))}
              </optgroup>
            )}
            {passwordGroups.length > 0 && (
              <optgroup label="Password Groups">
                {passwordGroups.map((grp) => (
                  <option key={grp} value={`breach_group:${grp}`}>
                    Group '{grp}' Leaked
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {isScenarioLoading && (
            <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
          )}
        </div>

        {/* Toggle Advanced Filters */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            showAdvanced || hasActiveFilters
              ? 'border-cyan-500/40 bg-cyan-950/30 text-cyan-300'
              : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-bold text-cyan-400">
              •
            </span>
          )}
        </button>

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 px-2 py-1 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Path Filter Active Notification */}
      {filters.fallsIfTarget !== 'NONE' && scenarioAffectedIds && (
        <div className="flex items-center justify-between rounded-lg bg-rose-950/30 border border-rose-900/40 px-3 py-2 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
            <span>
              Highlighted accounts that fall if{' '}
              <strong className="text-white">
                {filters.fallsIfTarget.replace('entry:', '').replace('compromise:', '').replace('breach_group:', 'Group ')}
              </strong>{' '}
              is compromised.
            </span>
          </div>
          <span className="font-bold text-rose-200">
            {scenarioAffectedIds.size} accounts affected
          </span>
        </div>
      )}

      {/* Advanced Filters Row */}
      {showAdvanced && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80">
          {/* Service Type */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
              Service Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => onChange({ ...filters, type: e.target.value })}
              className="w-full rounded-md border border-slate-800 bg-slate-950/90 px-2 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="email">Email</option>
              <option value="social">Social</option>
              <option value="shopping">Shopping</option>
              <option value="finance">Finance</option>
              <option value="payments">Payments</option>
              <option value="storage">Storage</option>
              <option value="entertainment">Entertainment</option>
              <option value="professional">Professional</option>
              <option value="utility_app">Utility App</option>
              <option value="forum">Forum</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* 2FA Method */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
              2FA Method
            </label>
            <select
              value={filters.secondFactor}
              onChange={(e) => onChange({ ...filters, secondFactor: e.target.value })}
              className="w-full rounded-md border border-slate-800 bg-slate-950/90 px-2 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All 2FA Methods</option>
              <option value="none">None (Weakest)</option>
              <option value="sms">SMS</option>
              <option value="authenticator">Authenticator</option>
              <option value="hardware_key">Hardware Key</option>
            </select>
          </div>

          {/* Data Held */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
              Data Held
            </label>
            <select
              value={filters.dataHeld}
              onChange={(e) => onChange({ ...filters, dataHeld: e.target.value })}
              className="w-full rounded-md border border-slate-800 bg-slate-950/90 px-2 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All Data</option>
              <option value="payment">Payment Info</option>
              <option value="government_id">Gov ID / Passport</option>
              <option value="financial_records">Financial Records</option>
              <option value="private_messages">Private Messages</option>
              <option value="work_data">Work Data</option>
              <option value="photos">Photos</option>
              <option value="contacts">Contacts</option>
              <option value="location_history">Location History</option>
            </select>
          </div>

          {/* Last Activity */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
              Last Activity
            </label>
            <select
              value={filters.activityBucket}
              onChange={(e) => onChange({ ...filters, activityBucket: e.target.value })}
              className="w-full rounded-md border border-slate-800 bg-slate-950/90 px-2 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">Any Time</option>
              <option value="recent">&lt; 90 days (Active)</option>
              <option value="medium">90–365 days (Inactive)</option>
              <option value="stale">&gt; 365 days (Stale / Dormant)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
