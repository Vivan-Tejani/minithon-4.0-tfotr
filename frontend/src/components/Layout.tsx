import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Bell, RefreshCw, Database, Shield, Radio, Activity, AlertCircle } from 'lucide-react'
import { useReview, useSeedDemo } from '../api/hooks'
import { AlertsPanel } from './AlertsPanel'
import { AccountDetail } from './AccountDetail'
import { useToast } from './ui'

export const Layout: React.FC = () => {
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const { data: reviewData } = useReview()
  const seedMutation = useSeedDemo()
  const { showToast } = useToast()

  const alertCount = reviewData?.items?.length ?? 0
  const isUsingMock = import.meta.env.VITE_USE_MOCK !== 'false'

  const handleSeedDemo = async () => {
    try {
      await seedMutation.mutateAsync()
      showToast('Persona Loaded', 'Demo persona (12 accounts, anchors) seeded successfully', 'success')
    } catch (e: any) {
      showToast('Error', e.message, 'error')
    }
  }

  const navLinks = [
    { to: '/', label: 'DASHBOARD', icon: <Activity className="w-3.5 h-3.5" /> },
    { to: '/accounts', label: 'ACCOUNTS & INVENTORY', icon: <Database className="w-3.5 h-3.5" /> },
    { to: '/fixes', label: 'FIX CHECKLIST', icon: <Shield className="w-3.5 h-3.5" /> },
    { to: '/scenarios', label: 'ATTACK SCENARIOS', icon: <Radio className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-100 font-sans">
      {/* Top Telemetry Header */}
      <header className="sticky top-0 z-40 bg-[#090e1a]/95 backdrop-blur-md border-b border-[#1c2638] px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <NavLink to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                <Shield className="w-4 h-4 text-slate-950 font-bold" />
              </div>
              <div>
                <span className="font-mono-code font-bold tracking-wider text-sm text-slate-100 group-hover:text-cyan-400 transition-colors">
                  CHOKEPOINT
                </span>
                <span className="text-[10px] text-cyan-400/80 font-mono-code block -mt-1 tracking-tight">
                  AUDITOR v1.0
                </span>
              </div>
            </NavLink>

            {/* Navigation Routes */}
            <nav className="hidden md:flex items-center gap-1 font-mono-code text-xs">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all font-medium ${
                      isActive
                        ? 'bg-[#152037] text-cyan-300 border border-cyan-800/60 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1627]'
                    }`
                  }
                >
                  {link.icon}
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right Tools & Alert Bell */}
          <div className="flex items-center gap-3">
            {/* Mock / Live State Pill */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono-code border bg-[#0d131f] border-[#1c2638] text-slate-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isUsingMock ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span>{isUsingMock ? 'MODE: MOCK SIM' : 'MODE: LIVE API'}</span>
            </div>

            {/* Load Demo Persona CTA */}
            <button
              onClick={handleSeedDemo}
              disabled={seedMutation.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-mono-code bg-[#121a2c] hover:bg-[#1a253e] text-slate-300 hover:text-cyan-300 px-2.5 py-1.5 rounded border border-[#222e47] transition-all cursor-pointer"
              title="Load standard PRD §9 persona dataset"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${seedMutation.isPending ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Reset / Load Persona</span>
            </button>

            {/* Alerts Bell */}
            <button
              onClick={() => setIsAlertsOpen(true)}
              className="relative p-2 rounded-md bg-[#121a2c] hover:bg-[#1a253e] text-slate-300 hover:text-slate-100 border border-[#222e47] transition-colors cursor-pointer"
              aria-label="Open Security Alerts"
            >
              <Bell className="w-4 h-4" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white font-mono-code text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {alertCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center gap-1 py-2 border-t border-[#1c2638] overflow-x-auto text-[11px] font-mono-code">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-2.5 py-1 rounded whitespace-nowrap ${
                  isActive ? 'bg-[#152037] text-cyan-300' : 'text-slate-400'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        <Outlet />
      </main>

      {/* Mandatory PRD Disclaimer Footer */}
      <footer className="border-t border-[#1c2638] py-4 px-4 text-center bg-[#070a12] text-xs text-slate-400 font-mono-code">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Model-based estimate, not a measured probability. Data stays on this device.
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Chokepoint Security Auditor • No external telemetry • Localhost engine
          </div>
        </div>
      </footer>

      {/* Global Alerts Drawer */}
      <AlertsPanel isOpen={isAlertsOpen} onClose={() => setIsAlertsOpen(false)} />

      {/* Global Account Detail Drawer */}
      <AccountDetail />
    </div>
  )
}
