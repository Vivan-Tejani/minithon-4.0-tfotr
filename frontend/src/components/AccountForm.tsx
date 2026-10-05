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
      className="space-y-4 text-xs"
    >
      {/* Service Catalog Prefill */}
      {isNew && catalog && (
        <div className="space-y-1">
          <label className="block font-medium text-zinc-300">
            Prefill from service catalog
          </label>
          <select
            value={form.service_key}
            onChange={(e) => handleServiceSelect(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
          >
            <option value="">Choose known service or configure custom</option>
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
        <div className="space-y-1">
          <label className="block font-medium text-zinc-300">
            Account slug
          </label>
          <input
            type="text"
            required
            disabled={!isNew}
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
            placeholder="e.g. google_main"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono-code focus:outline-none focus:border-zinc-600 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label className="block font-medium text-zinc-300">
            Service name
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Primary Gmail"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
          />
        </div>
      </div>

      {/* Security Credentials */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block font-medium text-zinc-300">
            Second factor (2FA)
          </label>
          <select
            value={form.second_factor}
            onChange={(e) => setForm({ ...form, second_factor: e.target.value as SecondFactor })}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
          >
            <option value="none">None (Password only)</option>
            <option value="sms">SMS verification code</option>
            <option value="authenticator">Authenticator app (TOTP)</option>
            <option value="hardware_key">Hardware key (FIDO2)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block font-medium text-zinc-300">
            Password group
          </label>
          <input
            type="text"
            value={form.password_group || ''}
            onChange={(e) => setForm({ ...form, password_group: e.target.value.trim() || null })}
            placeholder="e.g. A, B (leave empty if unique)"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
          />
        </div>
      </div>

      {/* Recovery Routes */}
      <div className="space-y-2 pt-1">
        <label className="block font-medium text-zinc-300">
          Recovery options
        </label>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer text-zinc-300">
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
              className="rounded border-zinc-700 bg-zinc-900 accent-zinc-100"
            />
            <span>SMS phone recovery</span>
          </label>
        </div>

        {emailAccounts.length > 0 && (
          <div className="space-y-1 pt-1">
            <span className="text-xs text-zinc-400">Recovery email account:</span>
            <div className="flex flex-wrap gap-1.5">
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
                    className={`px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-medium'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {ea.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Live Ghost Preview for Counterfactual Feedback */}
      <div className="pt-2">
        <PreviewCard
          request={{
            op: 'upsert_account',
            account: form,
          }}
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={isSaving}>
          {isNew ? 'Create account' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
