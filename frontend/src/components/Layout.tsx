import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Bell,
  Sparkles,
  RotateCcw,
  Shield,
  SlidersHorizontal,
} from 'lucide-react'
import { useReview, useSeedDemo, useResetState } from '../api/hooks'
import { AlertsPanel } from './AlertsPanel'
import { AccountDetail } from './AccountDetail'
import { EndpointDrawer } from './EndpointDrawer'
import { useToast, Button } from './ui'

export const Layout: React.FC = () => {
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)
  const [isEndpointsOpen, setIsEndpointsOpen] = useState(false)

  const { data: reviewData } = useReview()
  const seedMutation = useSeedDemo()
  const resetMutation = useResetState()
  const { showToast } = useToast()

  const alertCount = reviewData?.items?.length ?? 0

  const handleSeedDemo = async () => {
    try {
      await seedMutation.mutateAsync()
      showToast('Persona loaded', 'Demo persona (12 accounts) seeded successfully', 'success')
    } catch (e: any) {
      showToast('Error', e?.message || 'Failed to seed demo persona', 'error')
    }
  }

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync()
      showToast('Inventory reset', 'Cleared all accounts to empty state', 'warning')
    } catch (e: any) {
      showToast('Error', e?.message || 'Failed to reset inventory', 'error')
    }
  }

  const navLinks = [
    { to: '/', label: 'Dashboard' },
    { to: '/accounts', label: 'Accounts & inventory' },
    { to: '/fixes', label: 'Fix checklist' },
    { to: '/scenarios', label: 'Attack scenarios' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-50 font-sans">
      {/* Slim Top Navigation */}
      <header className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-md border-b border-zinc-800/80 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
          {/* Brand & Left Navigation */}
          <div className="flex items-center gap-8">
            <NavLink to="/" className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-zinc-100" />
              <span className="font-semibold text-sm tracking-tight text-zinc-100">
                Chokepoint
              </span>
            </NavLink>

            {/* Navigation Routes: pure text links, active = foreground, inactive = muted */}
            <nav className="hidden md:flex items-center gap-6 text-sm">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `transition-colors ${
                      isActive
                        ? 'text-zinc-50 font-medium'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Endpoints settings trigger */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEndpointsOpen(true)}
              className="text-xs text-zinc-400 hover:text-zinc-100"
              title="Routing and telemetry endpoints"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline">Settings</span>
            </Button>

            {/* Load Persona */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedDemo}
              disabled={seedMutation.isPending}
              className="text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline">Load demo persona</span>
            </Button>

            {/* Reset */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="text-xs text-zinc-400 hover:text-zinc-100"
              title="Reset inventory"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>

            {/* Alerts Bell */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsAlertsOpen(true)}
              className="relative text-zinc-400 hover:text-zinc-100"
              aria-label="Open security alerts"
            >
              <Bell className="w-4 h-4" />
              {alertCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center gap-4 py-2 border-t border-zinc-800/80 overflow-x-auto text-xs">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `whitespace-nowrap transition-colors ${
                  isActive ? 'text-zinc-50 font-medium' : 'text-zinc-400'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <Outlet />
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-zinc-800/80 py-6 px-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Model-based estimate, not a measured probability. Data stays on this device.</span>
          <span>Chokepoint security auditor</span>
        </div>
      </footer>

      {/* Drawers */}
      <EndpointDrawer isOpen={isEndpointsOpen} onClose={() => setIsEndpointsOpen(false)} />
      <AlertsPanel isOpen={isAlertsOpen} onClose={() => setIsAlertsOpen(false)} />
      <AccountDetail />
    </div>
  )
}
