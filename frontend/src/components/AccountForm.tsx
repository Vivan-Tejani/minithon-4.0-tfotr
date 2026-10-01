import React, { useState } from 'react';
import type { Account, CatalogEntry } from '../api/types';
import { PreviewCard } from './PreviewCard';
import { AlertCircle, Check, Key, Shield } from 'lucide-react';

const ALL_PERMISSIONS = [
  'sms',
  'location',
  'contacts',
  'camera',
  'microphone',
  'photos',
  'files',
];

const ALL_DATA_HELD = [
  'payment',
  'government_id',
  'health',
  'financial_records',
  'private_messages',
  'work_data',
  'photos',
  'contacts',
  'location_history',
  'profile_only',
];

interface AccountFormProps {
  initialAccount?: Account | null;
  catalog: CatalogEntry[];
  existingAccounts: Account[];
  onSave: (account: Account) => Promise<void>;
  onCancel: () => void;
  onGhostChange?: (ghost: any | null) => void;
}

export const AccountForm: React.FC<AccountFormProps> = ({
  initialAccount,
  catalog,
  existingAccounts,
  onSave,
  onCancel,
  onGhostChange,
}) => {
  const isEditing = Boolean(initialAccount);

  const [formData, setFormData] = useState<Account>(() => {
    if (initialAccount) {
      return { ...initialAccount };
    }
    const today = new Date().toISOString().split('T')[0];
    return {
      id: '',
      name: '',
      service_key: 'custom',
      type: 'other',
      login_methods: ['password'],
      second_factor: 'none',
      recovery: [],
      password_group: null,
      permissions: [],
      data_held: ['profile_only'],
      last_activity: today,
      breach_flag: false,
      importance_override: null,
    };
  });

  const [selectedService, setSelectedService] = useState<string>(
    initialAccount?.service_key || 'custom'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available email accounts for recovery & SSO
  const emailAccounts = existingAccounts.filter(
    (a) => a.type === 'email' && a.id !== formData.id
  );

  // All accounts that could be SSO targets
  const ssoTargetAccounts = existingAccounts.filter((a) => a.id !== formData.id);

  // Existing password groups for datalist
  const existingGroups = Array.from(
    new Set(existingAccounts.map((a) => a.password_group).filter(Boolean))
  ) as string[];

  // Catalog entry for current service
  const currentCatalog = catalog.find((c) => c.key === selectedService);

  // Auto-slugify name to id if creating
  const handleNameChange = (name: string) => {
    setFormData((prev) => {
      const updated = { ...prev, name };
      if (!isEditing && (!prev.id || prev.id === prev.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))) {
        updated.id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      }
      return updated;
    });
  };

  // Handle service prefill
  const handleServiceSelect = (key: string) => {
    setSelectedService(key);
    if (key === 'custom') {
      setFormData((prev) => ({ ...prev, service_key: 'custom' }));
      return;
    }

    const cat = catalog.find((c) => c.key === key);
    if (cat) {
      setFormData((prev) => {
        const idVal = isEditing ? prev.id : cat.key;
        return {
          ...prev,
          id: idVal,
          name: prev.name || cat.name,
          service_key: cat.key,
          type: cat.type,
          login_methods: cat.login_methods_supported.includes('password')
            ? ['password']
            : cat.login_methods_supported.slice(0, 1),
          second_factor: 'none',
          permissions: [...cat.typical_permissions],
          data_held: [...cat.default_data_held],
        };
      });
    }
  };

  const toggleLoginMethod = (method: string) => {
    setFormData((prev) => {
      const exists = prev.login_methods.includes(method);
      const nextMethods = exists
        ? prev.login_methods.filter((m) => m !== method)
        : [...prev.login_methods, method];
      return { ...prev, login_methods: nextMethods };
    });
  };

  const toggleRecovery = (rec: string) => {
    setFormData((prev) => {
      const exists = prev.recovery.includes(rec);
      const nextRec = exists
        ? prev.recovery.filter((r) => r !== rec)
        : [...prev.recovery, rec];
      return { ...prev, recovery: nextRec };
    });
  };

  const togglePermission = (perm: string) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(perm);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm],
      };
    });
  };

  const toggleDataHeld = (dataItem: string) => {
    setFormData((prev) => {
      const exists = prev.data_held.includes(dataItem);
      return {
        ...prev,
        data_held: exists
          ? prev.data_held.filter((d) => d !== dataItem)
          : [...prev.data_held, dataItem],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim()) {
      setErrorMessage('Account name is required');
      return;
    }
    if (!formData.id.trim()) {
      setErrorMessage('Account ID is required');
      return;
    }
    if (formData.login_methods.length === 0 && formData.recovery.length === 0) {
      setErrorMessage('Must specify at least one login or recovery method');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(formData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg bg-rose-950/40 border border-rose-800/80 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Catalog Prefill Selector */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Service Preset (Catalog Prefill)
        </label>
        <select
          value={selectedService}
          onChange={(e) => handleServiceSelect(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
        >
          <option value="custom">Custom Service / App</option>
          {catalog.map((cat) => (
            <option key={cat.key} value={cat.key}>
              {cat.name} ({cat.type})
            </option>
          ))}
        </select>
        {currentCatalog && (
          <p className="mt-1.5 text-[11px] text-slate-400">
            Prefilled with defaults for {currentCatalog.name}. You can customize credentials and recovery below.
          </p>
        )}
      </div>

      {/* Basic Identity Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Account Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Personal Gmail"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Unique Account ID (Slug) *
          </label>
          <input
            type="text"
            required
            disabled={isEditing}
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
            placeholder="e.g. personal_gmail"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 font-mono disabled:opacity-60 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Service Category
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          >
            <option value="email">Email Account</option>
            <option value="social">Social Media</option>
            <option value="shopping">Shopping</option>
            <option value="finance">Finance / Banking</option>
            <option value="payments">Payments (UPI / Wallet)</option>
            <option value="storage">Cloud Storage / Drive</option>
            <option value="entertainment">Entertainment / Streaming</option>
            <option value="professional">Professional / Work</option>
            <option value="utility_app">Utility App</option>
            <option value="forum">Community Forum</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Last Activity Date
          </label>
          <input
            type="date"
            value={formData.last_activity}
            onChange={(e) => setFormData({ ...formData, last_activity: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Authentication & Security Settings */}
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <Key className="h-3.5 w-3.5" />
          Authentication & Sign-In
        </h4>

        {/* Login Methods */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Enabled Login Methods
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={formData.login_methods.includes('password')}
                onChange={() => toggleLoginMethod('password')}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Master / Group Password</span>
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={formData.login_methods.includes('sms_otp')}
                onChange={() => toggleLoginMethod('sms_otp')}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>SMS OTP Direct Login</span>
            </label>

            {ssoTargetAccounts.map((target) => (
              <label
                key={target.id}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300 cursor-pointer hover:border-slate-700"
              >
                <input
                  type="checkbox"
                  checked={formData.login_methods.includes(`sso:${target.id}`)}
                  onChange={() => toggleLoginMethod(`sso:${target.id}`)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Sign in with {target.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Second Factor */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Second-Factor Authentication (2FA)
          </label>
          <select
            value={formData.second_factor}
            onChange={(e) => setFormData({ ...formData, second_factor: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          >
            <option value="none">None (Password or OTP only)</option>
            <option value="sms">SMS Text Message Code</option>
            <option value="authenticator">Authenticator App (TOTP)</option>
            <option value="hardware_key">FIDO Hardware Key (YubiKey)</option>
          </select>
          {currentCatalog && !currentCatalog.second_factors_supported.includes(formData.second_factor as any) && formData.second_factor !== 'none' && (
            <p className="mt-1 text-[11px] text-amber-400">
              Note: {currentCatalog.name} typically does not support {formData.second_factor} 2FA.
            </p>
          )}
        </div>

        {/* Password Group */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Password Reuse Group
          </label>
          <input
            type="text"
            list="password-groups-datalist"
            value={formData.password_group || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                password_group: e.target.value.trim() ? e.target.value.trim() : null,
              })
            }
            placeholder="e.g. Group A, SocialPass, BankingPass (leave empty if unique)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          />
          <datalist id="password-groups-datalist">
            {existingGroups.map((grp) => (
              <option key={grp} value={grp} />
            ))}
          </datalist>
          <p className="mt-1 text-[11px] text-slate-500 italic">
            Label only — never type a real password!
          </p>
        </div>

        {/* Recovery Options */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Account Recovery Channels
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.recovery.includes('sms')}
                onChange={() => toggleRecovery('sms')}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Allow password reset via SMS code to phone</span>
            </label>

            {emailAccounts.length > 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2.5">
                <span className="block text-[11px] text-slate-400 mb-1.5 font-medium">
                  Recovery Emails:
                </span>
                <div className="flex flex-wrap gap-2">
                  {emailAccounts.map((ea) => (
                    <label
                      key={ea.id}
                      className="flex items-center gap-1.5 rounded bg-slate-900 px-2 py-1 text-xs text-slate-300 cursor-pointer hover:bg-slate-800 border border-slate-700/60"
                    >
                      <input
                        type="checkbox"
                        checked={formData.recovery.includes(`email:${ea.id}`)}
                        onChange={() => toggleRecovery(`email:${ea.id}`)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>{ea.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permissions and Data Held */}
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Permissions & High-Value Data
        </h4>

        {/* Permissions */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            App Permissions Granted
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_PERMISSIONS.map((perm) => {
              const active = formData.permissions.includes(perm);
              return (
                <button
                  type="button"
                  key={perm}
                  onClick={() => togglePermission(perm)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {perm}
                </button>
              );
            })}

            {/* Email inbox permissions on other email accounts */}
            {emailAccounts.map((ea) => {
              const inboxPerm = `email_inbox:${ea.id}`;
              const active = formData.permissions.includes(inboxPerm);
              return (
                <button
                  type="button"
                  key={inboxPerm}
                  onClick={() => togglePermission(inboxPerm)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  read {ea.name} inbox
                </button>
              );
            })}
          </div>
        </div>

        {/* Data Held */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Data Stored in Account
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_DATA_HELD.map((d) => {
              const active = formData.data_held.includes(d);
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDataHeld(d)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {d.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Flags & Importance Override */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={formData.breach_flag}
              onChange={(e) => setFormData({ ...formData, breach_flag: e.target.checked })}
              className="rounded border-slate-700 text-rose-500 focus:ring-0"
            />
            <span className="text-rose-300 font-medium">Flagged in known credential breach</span>
          </label>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Custom Importance Override (1–10, optional)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.importance_override ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                setFormData({ ...formData, importance_override: isNaN(val as any) ? null : val });
              }}
              placeholder="Auto-derived from data"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* M1-07: Ghost Preview Card Embedded into the Form */}
      {formData.id && (
        <PreviewCard
          request={{ op: 'upsert_account', account: formData }}
          onGhostChange={onGhostChange}
        />
      )}

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          <span>{isEditing ? 'Save Changes' : 'Create Account'}</span>
        </button>
      </div>
    </form>
  );
};
