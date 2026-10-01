import React, { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Bell,
  Sparkles,
  RotateCcw,
  Database,
  Shield,
  Radio,
  Activity,
  AlertCircle,
  Sliders,
} from 'lucide-react'
import { useReview, useSeedDemo, useResetState } from '../api/hooks'
import { isMasterMockEnabled, onOverridesChange } from '../api/client'
import { AlertsPanel } from './AlertsPanel'
import { AccountDetail } from './AccountDetail'
import { EndpointDrawer } from './EndpointDrawer'
import { useToast } from './ui'

export const Layout: React.FC = () => {
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const [isEndpointsOpen, setIsEndpointsOpen] = useState(false)
  const [isUsingMock, setIsUsingMock] = useState(isMasterMockEnabled())

  const { data: reviewData } = useReview()
  const seedMutation = useSeedDemo()
  const resetMutation = useResetState()
  const { showToast } = useToast()

  useEffect(() => {
    return onOverridesChange(() => {
      setIsUsingMock(isMasterMockEnabled())
    })
  }, [])

  const alertCount = reviewData?.items?.length ?? 0

  const handleSeedDemo = async () => {
    try {
      await seedMutation.mutateAsync()
      showToast('Persona Loaded', 'Demo persona (12 accounts, anchors) seeded successfully', 'success')
    } catch (e: any) {
      showToast('Error', e?.message || 'Failed to seed demo persona', 'error')
    }
  }

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync()
      showToast('Inventory Reset', 'Cleared all accounts and reset to default empty state', 'warning')
    } catch (e: any) {
      showToast('Error', e?.message || 'Failed to reset inventory', 'error')
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

          {/* Right Tools & Controls */}
          <div className="flex items-center gap-2.5">
            {/* Mock / Live State Switcher Pill */}
            <button
              onClick={() => setIsEndpointsOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono-code border bg-[#0d131f] hover:bg-[#131b2e] border-[#1c2638] hover:border-cyan-800/80 text-slate-300 transition-all cursor-pointer"
              title="Configure per-endpoint live/mock routing"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isUsingMock ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]' : 'bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                }`}
              />
              <span className="hidden sm:inline font-semibold">
                {isUsingMock ? 'MODE: MOCK SIM' : 'MODE: LIVE API'}
              </span>
              <Sliders className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {/* Load Demo Persona Button */}
            <button
              onClick={handleSeedDemo}
              disabled={seedMutation.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-mono-code bg-[#121a2c] hover:bg-[#1a253e] text-slate-300 hover:text-cyan-300 px-2.5 py-1.5 rounded border border-[#222e47] transition-all cursor-pointer disabled:opacity-50"
              title="Load standard PRD §9 persona dataset"
            >
              <Sparkles
                className={`w-3.5 h-3.5 text-cyan-400 ${seedMutation.isPending ? 'animate-spin' : ''}`}
              />
              <span className="hidden xl:inline">Load Persona</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-mono-code bg-[#16121f] hover:bg-[#231a30] text-slate-400 hover:text-red-300 px-2.5 py-1.5 rounded border border-[#2d2238] transition-all cursor-pointer disabled:opacity-50"
              title="Reset inventory to empty state"
            >
              <RotateCcw
                className={`w-3.5 h-3.5 text-red-400 ${resetMutation.isPending ? 'animate-spin' : ''}`}
              />
              <span className="hidden xl:inline">Reset</span>
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
        <div className="md:hidden flex items-center justify-between py-2 border-t border-[#1c2638] overflow-x-auto text-[11px] font-mono-code gap-1">
          <div className="flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-2 py-1 rounded whitespace-nowrap ${
                    isActive ? 'bg-[#152037] text-cyan-300' : 'text-slate-400'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSeedDemo}
              disabled={seedMutation.isPending}
              className="p-1 rounded bg-[#121a2c] text-cyan-400"
              title="Load Demo Persona"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="p-1 rounded bg-[#16121f] text-red-400"
              title="Reset State"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
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

      {/* Endpoint Routing Matrix Drawer */}
      <EndpointDrawer isOpen={isEndpointsOpen} onClose={() => setIsEndpointsOpen(false)} />

      {/* Global Alerts Drawer */}
      <AlertsPanel isOpen={isAlertsOpen} onClose={() => setIsAlertsOpen(false)} />

      {/* Global Account Detail Drawer */}
      <AccountDetail />
    </div>
  )
}
