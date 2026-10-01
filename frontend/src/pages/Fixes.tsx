import React, { useState, useEffect } from 'react';
import { FixCard, FixItem, PreviewData } from '../components/FixCard';

interface FixesResponse {
  plan: FixItem[];
  best3: string[];
  quick_wins: string[];
  base_score: number;
}

interface ToastMessage {
  id: string;
  text: string;
}

export const Fixes: React.FC = () => {
  const [fixesData, setFixesData] = useState<FixesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuickWinsOnly, setShowQuickWinsOnly] = useState(false);
  const [applyingFixId, setApplyingFixId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchFixes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fixes');
      if (!res.ok) {
        throw new Error(`Failed to load fixes: ${res.statusText}`);
      }
      const data = await res.json();
      setFixesData(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching fixes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFixes();
  }, []);

  const handleApplyFix = async (fixId: string) => {
    try {
      setApplyingFixId(fixId);
      const res = await fetch(`/api/fixes/${encodeURIComponent(fixId)}/apply`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Failed to apply fix: ${res.statusText}`);
      }
      const applyResult = await res.json();

      // Show toast
      const diff = applyResult.score_after - applyResult.score_before;
      const toastText = `Score ${applyResult.score_before} → ${applyResult.score_after} (+${diff})`;
      setToast({ id: Date.now().toString(), text: toastText });
      setTimeout(() => setToast(null), 4000);

      // Refresh plan data
      await fetchFixes();
    } catch (err: any) {
      alert(`Error applying fix: ${err.message}`);
    } finally {
      setApplyingFixId(null);
    }
  };

  const handlePreviewFix = async (fixId: string): Promise<PreviewData | null> => {
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'apply_fix', fix_id: fixId }),
      });
      if (!res.ok) {
        throw new Error('Preview failed');
      }
      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  if (loading && !fixesData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Evaluating takeover attack graph...</p>
        </div>
      </div>
    );
  }

  if (error && !fixesData) {
    return (
      <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
        <h3 className="font-semibold text-base mb-1">Failed to load recommendations</h3>
        <p className="text-sm opacity-90">{error}</p>
        <button
          onClick={fetchFixes}
          className="mt-4 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  const baseScore = fixesData?.base_score ?? 61;
  const best3Items = fixesData?.plan.filter((f) => f.in_best3) ?? [];
  const projectedBest3Score =
    best3Items.length > 0 ? best3Items[best3Items.length - 1].score_after : baseScore;
  const best3Delta = projectedBest3Score - baseScore;

  const displayList = fixesData?.plan.filter((f) => {
    if (showQuickWinsOnly) {
      return f.effort === 'low';
    }
    return true;
  }) ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Toast Notification */}
      {toast && (
        <div
          id="score-toast"
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-300 shadow-xl shadow-emerald-500/10 flex items-center gap-3 animate-slideUp"
        >
          <span className="text-lg">🎉</span>
          <span className="font-semibold text-sm">{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Recommended Privacy Fixes
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Counterfactual Takeover Planner ranks the smallest set of actions that remove the
          most risk.
        </p>
      </div>

      {/* Best-3 Banner */}
      {best3Items.length >= 3 && (
        <div
          id="best-3-banner"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/70 via-purple-950/40 to-slate-900 border border-indigo-500/30 p-6 md:p-8"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Optimal Action Plan
              </span>
              <h2 className="text-xl md:text-2xl font-bold text-white">
                Do these 3 fixes → score{' '}
                <span className="text-slate-300">{baseScore}</span> →{' '}
                <span className="text-emerald-400">{projectedBest3Score}</span>
              </h2>
              <p className="text-sm text-slate-300 max-w-xl">
                Targeting these 3 chokepoints eliminates redundant attacks and protects your digital
                footprint with a{' '}
                <strong className="text-emerald-400">+{best3Delta} point increase</strong>.
              </p>
            </div>

            <div className="flex-shrink-0 flex items-center gap-3">
              <div className="text-center px-4 py-3 rounded-xl bg-slate-900/80 border border-indigo-500/20">
                <span className="block text-2xl font-extrabold text-emerald-400">
                  +{best3Delta}
                </span>
                <span className="text-xs text-slate-400 font-medium">Points Gain</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls & Filter Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="filter-all-btn"
            onClick={() => setShowQuickWinsOnly(false)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              !showQuickWinsOnly
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            All Ranked Fixes ({fixesData?.plan.length ?? 0})
          </button>

          <button
            type="button"
            id="filter-quick-wins-btn"
            onClick={() => setShowQuickWinsOnly(true)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              showQuickWinsOnly
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            Quick Wins Only ({fixesData?.quick_wins.length ?? 0})
          </button>
        </div>

        <span className="text-xs text-slate-500">
          Ranked by marginal expected risk reduction
        </span>
      </div>

      {/* Fixes List */}
      <div className="space-y-4">
        {displayList.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-slate-900/40 border border-slate-800">
            <p className="text-slate-400 text-sm">No fixes found matching this filter.</p>
          </div>
        ) : (
          displayList.map((fix) => (
            <FixCard
              key={fix.id}
              fix={fix}
              baseScore={baseScore}
              onApply={handleApplyFix}
              onPreview={handlePreviewFix}
              isApplying={applyingFixId === fix.id}
            />
          ))
        )}
      </div>

      {/* Disclaimer */}
      <footer className="pt-8 border-t border-slate-800/80 text-center text-xs text-slate-500">
        Model-based estimate, not a measured probability. Data stays on this device.
      </footer>
    </div>
  );
};
