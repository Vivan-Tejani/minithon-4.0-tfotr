import React, { useState } from 'react'
import type { Account, SecondFactor } from '../api/types'
import { useCatalog, useState_ } from '../api/hooks'
import { Button } from './ui'
import { PreviewCard } from './PreviewCard'

export interface AccountFormProps {
  initialAccount?: Account | null
  onSave: (account: Account, isNew: boolean) => Promise<void>
  onCancel: () => void
}

export const AccountForm: React.FC<AccountFormProps> = ({
  initialAccount,
  onSave,
  onCancel,
}) => {
  const { data: catalog } = useCatalog()
  const { data: appState } = useState_()

  const [form, setForm] = useState<Account>({
    id: initialAccount?.id || '',
    name: initialAccount?.name || '',
    service_key: initialAccount?.service_key || '',
    type: initialAccount?.type || 'other',
    login_methods: initialAccount?.login_methods || ['password'],
    second_factor: initialAccount?.second_factor || 'none',
    recovery: initialAccount?.recovery || [],
    password_group: initialAccount?.password_group ?? null,
    permissions: initialAccount?.permissions || [],
    data_held: initialAccount?.data_held || ['profile_only'],
    last_activity: initialAccount?.last_activity || new Date().toISOString().split('T')[0],
    breach_flag: initialAccount?.breach_flag || false,
    importance_override: initialAccount?.importance_override ?? null,
  })

  const [isSaving, setIsSaving] = useState(false)
  const isNew = !initialAccount

  // Catalog prefill
  const handleServiceSelect = (key: string) => {
    const item = catalog?.find((c) => c.key === key)
    if (!item) return

    setForm((prev) => ({
      ...prev,
      service_key: item.key,
      name: prev.name || item.name,
      type: item.type,
      login_methods: item.login_methods_supported.slice(0, 2),
      second_factor: item.second_factors_supported[0] || 'none',
      permissions: [...item.typical_permissions],
      data_held: [...item.default_data_held],
    }))
  }

  const emailAccounts = appState?.accounts.filter((a) => a.type === 'email' && a.id !== form.id) || []

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setIsSaving(true)
        try {
          await onSave(form, isNew)
        } finally {
          setIsSaving(false)
        }
      }}
      className="space-y-5"
    >
      {/* Service Catalog Prefill */}
      {isNew && catalog && (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Prefill from Service Catalog
          </label>
          <select
            value={form.service_key}
            onChange={(e) => handleServiceSelect(e.target.value)}
            className="w-full bg-[#070b14] border border-[#1c2638] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">-- Choose known service or configure custom --</option>
            {catalog.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Account Identifier (Slug)
          </label>
          <input
            type="text"
            required
            disabled={!isNew}
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
            placeholder="e.g. google_main"
            className="w-full bg-[#070b14] border border-[#1c2638] rounded px-3 py-1.5 text-xs text-slate-100 font-mono-code focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Service Name
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Primary Gmail"
            className="w-full bg-[#070b14] border border-[#1c2638] rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Security Credentials */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            2FA / Second Factor
          </label>
          <select
            value={form.second_factor}
            onChange={(e) => setForm({ ...form, second_factor: e.target.value as SecondFactor })}
            className="w-full bg-[#070b14] border border-[#1c2638] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="none">None (Single password/OTP)</option>
            <option value="sms">SMS OTP Code</option>
            <option value="authenticator">Authenticator App (TOTP)</option>
            <option value="hardware_key">Hardware Key (FIDO2/WebAuthn)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Password Group Label
          </label>
          <input
            type="text"
            value={form.password_group || ''}
            onChange={(e) => setForm({ ...form, password_group: e.target.value.trim() || null })}
            placeholder="e.g. A, B, or empty if unique"
            className="w-full bg-[#070b14] border border-[#1c2638] rounded px-3 py-1.5 text-xs text-slate-100 font-mono-code focus:outline-none focus:border-cyan-500"
          />
          <p className="text-[10px] text-slate-400 mt-0.5 italic">
            Label only — never enter real passwords.
          </p>
        </div>
      </div>

      {/* Recovery Routes */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          Recovery Gates (OR routes)
        </label>
        <div className="flex items-center gap-3 text-xs mb-2">
          <label className="inline-flex items-center gap-2 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={form.recovery.includes('sms')}
              onChange={(e) => {
                const checked = e.target.checked
                setForm((prev) => ({
                  ...prev,
                  recovery: checked
                    ? [...prev.recovery, 'sms']
                    : prev.recovery.filter((r) => r !== 'sms'),
                }))
              }}
              className="rounded bg-[#070b14] border-[#1c2638] text-cyan-500"
            />
            <span>SMS Phone Reset</span>
          </label>
        </div>

        {emailAccounts.length > 0 && (
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Recovery Backup Email:</span>
            <div className="flex flex-wrap gap-2">
              {emailAccounts.map((ea) => {
                const key = `email:${ea.id}`
                const isSelected = form.recovery.includes(key)
                return (
                  <button
                    type="button"
                    key={ea.id}
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        recovery: isSelected
                          ? prev.recovery.filter((r) => r !== key)
                          : [...prev.recovery, key],
                      }))
                    }}
                    className={`px-2.5 py-1 text-xs rounded border font-mono-code ${
                      isSelected
                        ? 'bg-cyan-950/70 text-cyan-300 border-cyan-700'
                        : 'bg-[#070b14] text-slate-400 border-[#1c2638]'
                    }`}
                  >
                    {ea.name} ({ea.id})
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Live Ghost Preview for Counterfactual Feedback */}
      <PreviewCard
        request={{
          op: 'upsert_account',
          account: form,
        }}
      />

      {/* Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1c2638]">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" type="submit" loading={isSaving}>
          {isNew ? 'Create Account Node' : 'Save Modifications'}
        </Button>
      </div>
    </form>
  )
}
