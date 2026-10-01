import React, { useState, useEffect, useMemo } from 'react';
import type {
  Account,
  Anchors,
  Analysis,
  CatalogEntry,
  Settings,
  State,
} from '../api/types';
import { api } from '../api/client';
import { FiltersBar } from '../components/FiltersBar';
import type { FilterState } from '../components/FiltersBar';
import { AccountForm } from '../components/AccountForm';
import {
  AlertTriangle,
  Download,
  Edit2,
  Lock,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  Shield,
  Smartphone,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';

export const AccountsPage: React.FC = () => {
  const [state, setState] = useState<State | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    band: 'ALL',
    type: 'ALL',
    dataHeld: 'ALL',
    secondFactor: 'ALL',
    activityBucket: 'ALL',
    fallsIfTarget: 'NONE',
  });

  // Scenario Filter Highlight Set
  const [scenarioAffectedIds, setScenarioAffectedIds] = useState<Set<string> | undefined>(undefined);
  const [scenarioLoading, setScenarioLoading] = useState(false);

  // Form Modal/Drawer State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Settings Drawer State (M1-08)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [threatSettings, setThreatSettings] = useState<Settings | null>(null);

  // Delete Confirmation Modal
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [deleteConflictError, setDeleteConflictError] = useState<{
    message: string;
    dependents: string[];
  } | null>(null);

  // Ghost representation for graph synchronization
  const [, setGhostView] = useState<any | null>(null);

  // Fetch initial state, analysis, catalog
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [stateRes, analysisRes, catalogRes] = await Promise.all([
        api.getState(),
        api.getAnalysis(),
        api.getCatalog(),
      ]);
      setState(stateRes);
      setAnalysis(analysisRes);
      setCatalog(catalogRes);
      setThreatSettings(stateRes.settings);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Anchors Toggle
  const handleToggleAnchor = async (key: 'sim_lock' | 'device_lock') => {
    if (!state) return;
    try {
      const updatedPhone = {
        ...state.anchors.phone,
        [key]: !state.anchors.phone[key],
      };
      const updatedAnchors: Anchors = { phone: updatedPhone };
      await api.updateAnchors(updatedAnchors);
      await loadData();
    } catch (err: any) {
      alert(`Failed to update anchor: ${err.message}`);
    }
  };

  // Handle Scenario Path Filter
  const handleScenarioFilterChange = async (targetValue: string) => {
    if (targetValue === 'NONE') {
      setScenarioAffectedIds(undefined);
      return;
    }

    try {
      setScenarioLoading(true);
      let kind: 'entry' | 'breach' | 'compromise' = 'entry';
      let target = targetValue;

      if (targetValue.startsWith('entry:')) {
        kind = 'entry';
        target = targetValue.replace('entry:', '');
      } else if (targetValue.startsWith('compromise:')) {
        kind = 'compromise';
        target = targetValue.replace('compromise:', '');
      } else if (targetValue.startsWith('breach_group:')) {
        kind = 'breach';
        // Pick first member of this group
        const grp = targetValue.replace('breach_group:', '');
        const member = state?.accounts.find((a) => a.password_group === grp);
        target = member ? member.id : grp;
      }

      const res = await api.runScenario({ kind, target });
      const affected = new Set<string>();
      res.cascade.forEach((rnd) => {
        rnd.accounts.forEach((acc) => affected.add(acc.id));
      });
      // also include target if it's an account
      if (kind === 'compromise') {
        affected.add(target);
      }
      setScenarioAffectedIds(affected);
    } catch {
      setScenarioAffectedIds(undefined);
    } finally {
      setScenarioLoading(false);
    }
  };

  // Save Account (Create or Update)
  const handleSaveAccount = async (accountData: Account) => {
    if (editingAccount) {
      await api.updateAccount(accountData.id, accountData);
    } else {
      await api.createAccount(accountData);
    }
    setIsFormOpen(false);
    setEditingAccount(null);
    setGhostView(null);
    await loadData();
  };

  // Delete Account
  const confirmDelete = async () => {
    if (!deletingAccount) return;
    try {
      setDeleteConflictError(null);
      await api.deleteAccount(deletingAccount.id);
      setDeletingAccount(null);
      await loadData();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('Cannot delete')) {
        setDeleteConflictError({
          message: err.message,
          dependents: err.data?.dependents || [],
        });
      } else {
        alert(err.message || 'Failed to delete account');
      }
    }
  };

  // Load Demo Persona
  const handleLoadDemo = async () => {
    try {
      setLoading(true);
      await api.seedDemo();
      await loadData();
    } catch (err: any) {
      alert(`Failed to load demo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Export State JSON (M1-08)
  const handleExport = async () => {
    try {
      const data = await api.exportState();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chokepoint-state-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Import State JSON (M1-08)
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        await api.importState(json);
        await loadData();
        alert('State successfully imported!');
      } catch (err: any) {
        alert(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Save Threat Settings (M1-08)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threatSettings) return;
    try {
      await api.updateSettings(threatSettings);
      setIsSettingsOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Failed to update settings: ${err.message}`);
    }
  };

  // Client-Side Multi-Filter Combination
  const filteredAccounts = useMemo(() => {
    if (!state) return [];
    const now = new Date();

    return state.accounts.filter((acct) => {
      // 1. Text Search
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const match =
          acct.name.toLowerCase().includes(q) ||
          acct.id.toLowerCase().includes(q) ||
          acct.service_key.toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Risk Band
      if (filters.band !== 'ALL') {
        const acctAnalysis = analysis?.accounts.find((a) => a.id === acct.id);
        if (acctAnalysis && acctAnalysis.band !== filters.band) {
          return false;
        }
      }

      // 3. Service Type
      if (filters.type !== 'ALL' && acct.type !== filters.type) {
        return false;
      }

      // 4. 2FA Method
      if (filters.secondFactor !== 'ALL' && acct.second_factor !== filters.secondFactor) {
        return false;
      }

      // 5. Data Held
      if (filters.dataHeld !== 'ALL' && !acct.data_held.includes(filters.dataHeld)) {
        return false;
      }

      // 6. Last Activity Bucket
      if (filters.activityBucket !== 'ALL') {
        const actDate = new Date(acct.last_activity);
        const diffDays = Math.floor((now.getTime() - actDate.getTime()) / (1000 * 3600 * 24));
        if (filters.activityBucket === 'recent' && diffDays >= 90) return false;
        if (filters.activityBucket === 'medium' && (diffDays < 90 || diffDays > 365)) return false;
        if (filters.activityBucket === 'stale' && diffDays <= 365) return false;
      }

      return true;
    });
  }, [state, analysis, filters]);

  // Risk band lookups helper
  const getAccountAnalysis = (id: string) => {
    return analysis?.accounts.find((a) => a.id === id);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-cyan-400" />
            Accounts & Threat Inventory
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Map sign-in channels, credential groups, and recovery pathways across your digital footprint.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Load Demo */}
          <button
            onClick={handleLoadDemo}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
            <span>Load Demo Persona</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:bg-slate-800 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>

          {/* Import JSON */}
          <label className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:bg-slate-800 cursor-pointer transition-colors">
            <Upload className="h-3.5 w-3.5" />
            <span>Import</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>

          {/* Settings Drawer Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:bg-slate-800 transition-colors"
          >
            <SettingsIcon className="h-3.5 w-3.5 text-slate-400" />
            <span>Threat Model</span>
          </button>

          {/* Add Account Button */}
          <button
            onClick={() => {
              setEditingAccount(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-cyan-600/30 hover:bg-cyan-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-950/40 border border-rose-800 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Anchor Safeguards Card */}
      {state && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SIM Lock Anchor */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg ${
                  state.anchors.phone.sim_lock
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                }`}
              >
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">Carrier SIM Lock / Port-Out PIN</h3>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      state.anchors.phone.sim_lock
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {state.anchors.phone.sim_lock ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Protects phone number from SIM-swapping. Multiplies SIM-swap probability by 0.25×.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggleAnchor('sim_lock')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                state.anchors.phone.sim_lock ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  state.anchors.phone.sim_lock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Device Lock Anchor */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg ${
                  state.anchors.phone.device_lock
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                }`}
              >
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">Device Screen Lock & Encryption</h3>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      state.anchors.phone.device_lock
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {state.anchors.phone.device_lock ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Stops physical thieves from extracting SMS OTPs or app authenticator codes.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggleAnchor('device_lock')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                state.anchors.phone.device_lock ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  state.anchors.phone.device_lock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      {state && (
        <FiltersBar
          filters={filters}
          onChange={setFilters}
          accounts={state.accounts}
          scenarioAffectedIds={scenarioAffectedIds}
          onScenarioFilterChange={handleScenarioFilterChange}
          isScenarioLoading={scenarioLoading}
        />
      )}

      {/* Accounts Inventory Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 shadow-xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Account & Service</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Authentication (2FA)</th>
                <th className="py-3 px-3">Password Group</th>
                <th className="py-3 px-3">Takeover Risk</th>
                <th className="py-3 px-3">Data Assets Held</th>
                <th className="py-3 px-3">Last Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No accounts match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acct) => {
                  const acctAnalysis = getAccountAnalysis(acct.id);
                  const isAffectedByScenario = scenarioAffectedIds?.has(acct.id);

                  return (
                    <tr
                      key={acct.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isAffectedByScenario
                          ? 'bg-rose-950/20 border-l-4 border-l-rose-500'
                          : ''
                      }`}
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-cyan-400 text-xs uppercase border border-slate-700/60">
                            {acct.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{acct.name}</span>
                              {acct.breach_flag && (
                                <span className="rounded bg-rose-950 text-rose-400 border border-rose-800/80 px-1.5 py-0.2 text-[9px] font-bold">
                                  BREACHED
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              id: {acct.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-3">
                        <span className="inline-block rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 font-medium border border-slate-700/50">
                          {acct.type}
                        </span>
                      </td>

                      {/* 2FA */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                            acct.second_factor === 'hardware_key'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                              : acct.second_factor === 'authenticator'
                              ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/50'
                              : acct.second_factor === 'sms'
                              ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                              : 'bg-rose-950/60 text-rose-400 border-rose-800/50'
                          }`}
                        >
                          {acct.second_factor === 'none' ? 'None' : acct.second_factor}
                        </span>
                      </td>

                      {/* Password Group */}
                      <td className="py-3.5 px-3">
                        {acct.password_group ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/50">
                            <Users className="h-3 w-3" />
                            {acct.password_group}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Unique</span>
                        )}
                      </td>

                      {/* Takeover Risk Band (with Tooltip) */}
                      <td className="py-3.5 px-3">
                        {acctAnalysis ? (
                          <div className="group relative inline-block">
                            <span
                              className={`cursor-help inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                                acctAnalysis.band === 'high'
                                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                                  : acctAnalysis.band === 'medium'
                                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                                  : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              }`}
                            >
                              {acctAnalysis.band}
                            </span>
                            {/* Hover Tooltip */}
                            <div className="invisible group-hover:visible absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 rounded-lg bg-slate-900 p-2 text-[10px] text-slate-300 shadow-xl border border-slate-700 pointer-events-none">
                              <div className="font-semibold text-white">
                                {Math.round(acctAnalysis.p * 100)}% Takeover Likelihood
                              </div>
                              <div className="text-slate-400 mt-0.5 italic">
                                Model-based estimate, not a measured fact.
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Data Held */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {acct.data_held.slice(0, 2).map((d) => (
                            <span
                              key={d}
                              className="rounded bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-400 border border-slate-800"
                            >
                              {d.replace('_', ' ')}
                            </span>
                          ))}
                          {acct.data_held.length > 2 && (
                            <span className="text-[10px] text-slate-500 pt-0.5">
                              +{acct.data_held.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-3 text-slate-400 text-[11px]">
                        {acct.last_activity}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAccount(acct);
                              setIsFormOpen(true);
                            }}
                            className="rounded p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                            title="Edit Account"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingAccount(acct)}
                            className="rounded p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Delete Account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Disclaimer per PRD §8 & §10 */}
      <div className="text-center text-[11px] text-slate-500 py-3">
        Model-based estimate, not a measured probability. Data stays locally on this device.
      </div>

      {/* Add / Edit Account Drawer Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-cyan-400" />
                {editingAccount ? `Edit ${editingAccount.name}` : 'Add New Account'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingAccount(null);
                  setGhostView(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <AccountForm
              initialAccount={editingAccount}
              catalog={catalog}
              existingAccounts={state?.accounts || []}
              onSave={handleSaveAccount}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingAccount(null);
                setGhostView(null);
              }}
              onGhostChange={setGhostView}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (handles 409 conflict gracefully) */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete {deletingAccount.name}?</h3>
            </div>

            {deleteConflictError ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-rose-950/50 border border-rose-800 p-3 text-xs text-rose-300">
                  <p className="font-semibold">{deleteConflictError.message}</p>
                  {deleteConflictError.dependents.length > 0 && (
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      {deleteConflictError.dependents.map((dep, idx) => (
                        <li key={idx}>{dep}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Please reassign or remove recovery/SSO dependencies before deleting this account.
                </p>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setDeletingAccount(null);
                      setDeleteConflictError(null);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Are you sure you want to delete <strong>{deletingAccount.name}</strong> ({deletingAccount.id})? This will update your takeover graph and recalculate risk scores.
                </p>
                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => setDeletingAccount(null)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-md shadow-rose-600/30"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Threat Settings Drawer (M1-08) */}
      {isSettingsOpen && threatSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-cyan-400" />
                Threat Model Assumptions (5-Year Horizon)
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">P(SIM Swap)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={threatSettings.p_sim}
                    onChange={(e) =>
                      setThreatSettings({ ...threatSettings, p_sim: parseFloat(e.target.value) })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">SIM Lock Multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={threatSettings.sim_lock_mult}
                    onChange={(e) =>
                      setThreatSettings({
                        ...threatSettings,
                        sim_lock_mult: parseFloat(e.target.value),
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">P(Phone Stolen)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={threatSettings.p_phone}
                    onChange={(e) =>
                      setThreatSettings({ ...threatSettings, p_phone: parseFloat(e.target.value) })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">P(Phish Email)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={threatSettings.p_phish_email}
                    onChange={(e) =>
                      setThreatSettings({
                        ...threatSettings,
                        p_phish_email: parseFloat(e.target.value),
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Base Leak Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={threatSettings.leak_base}
                    onChange={(e) =>
                      setThreatSettings({
                        ...threatSettings,
                        leak_base: parseFloat(e.target.value),
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Leak Cap</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={threatSettings.leak_cap}
                    onChange={(e) =>
                      setThreatSettings({
                        ...threatSettings,
                        leak_cap: parseFloat(e.target.value),
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setThreatSettings({
                      horizon_years: 5,
                      p_sim: 0.1,
                      sim_lock_mult: 0.25,
                      p_phone: 0.2,
                      p_phish_email: 0.15,
                      leak_base: 0.05,
                      leak_per_breach: 0.08,
                      leak_cap: 0.6,
                      leak_flagged_min: 0.8,
                      trials: 2000,
                      seed: 42,
                      band_low: 0.15,
                      band_high: 0.4,
                      stale_days: 365,
                      backup_email_stale_days: 180,
                    });
                  }}
                  className="text-xs text-cyan-400 hover:underline"
                >
                  Reset to Defaults
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-cyan-500"
                  >
                    Save Model
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
