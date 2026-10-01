import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AccountsPage } from './pages/Accounts';
import {
  Shield,
  LayoutDashboard,
  Users,
  Wrench,
  GitBranch,
  Bell,
  Sparkles,
} from 'lucide-react';

const NavHeader: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/accounts', label: 'Accounts', icon: Users },
    { path: '/fixes', label: 'Fixes & Plans', icon: Wrench },
    { path: '/scenarios', label: 'Scenarios', icon: GitBranch },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 shadow-md shadow-cyan-950 transition-all">
            <Shield className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-sm bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              CHOKEPOINT
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700">
              v1.0
            </span>
          </div>
        </Link>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right action / Bell */}
        <div className="flex items-center gap-2">
          <Link
            to="/accounts"
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Manage Inventory</span>
          </Link>
          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
            title="Alerts"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

// Shell stubs for other teammate routes
const DashboardStub = () => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center space-y-3">
      <LayoutDashboard className="h-12 w-12 text-cyan-400 mx-auto" />
      <h2 className="text-xl font-bold text-white">Privacy & Takeover Dashboard</h2>
      <p className="text-xs text-slate-400 max-w-md mx-auto">
        Switch to the <Link to="/accounts" className="text-cyan-400 underline font-semibold">Accounts</Link> page to audit credentials, test scenario cascades, and manage recovery chokepoints.
      </p>
    </div>
  </div>
);

const FixesStub = () => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center space-y-3">
      <Wrench className="h-12 w-12 text-cyan-400 mx-auto" />
      <h2 className="text-xl font-bold text-white">Counterfactual Fix Planner</h2>
      <p className="text-xs text-slate-400 max-w-md mx-auto">
        Greedy marginal ranking of top security fixes. Manage your accounts and SIM anchors in the{' '}
        <Link to="/accounts" className="text-cyan-400 underline font-semibold">Accounts</Link> inventory.
      </p>
    </div>
  </div>
);

const ScenariosStub = () => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center space-y-3">
      <GitBranch className="h-12 w-12 text-cyan-400 mx-auto" />
      <h2 className="text-xl font-bold text-white">Scenario Simulator & Cascade</h2>
      <p className="text-xs text-slate-400 max-w-md mx-auto">
        Test SIM swap and breach cascades hop-by-hop. The "Falls if ... is compromised" filter on the{' '}
        <Link to="/accounts" className="text-cyan-400 underline font-semibold">Accounts</Link> page uses this engine live.
      </p>
    </div>
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <NavHeader />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<DashboardStub />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/fixes" element={<FixesStub />} />
            <Route path="/scenarios" element={<ScenariosStub />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
