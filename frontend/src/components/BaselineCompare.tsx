import React from "react";

export interface PlanComparison {
  naive: {
    plan: string[];
    el_removed: number;
    score_after: number;
  };
  ours: {
    plan: string[];
    el_removed: number;
    score_after: number;
  };
}

export interface BaselineCompareProps {
  comparison?: PlanComparison | null;
  onApplyFix?: (fixId: string) => void;
}

export const BaselineCompare: React.FC<BaselineCompareProps> = ({
  comparison,
  onApplyFix,
}) => {
  // Default illustrative fallback matching PRD §3 & §9 if backend comparison is pending
  const data: PlanComparison = comparison || {
    naive: {
      plan: ["2fa:netflix", "2fa:canva", "2fa:amazon"],
      el_removed: 2.4,
      score_after: 48,
    },
    ours: {
      plan: ["sim_lock", "unique_pw:A", "rm_login:upi:sms_otp"],
      el_removed: 11.8,
      score_after: 68,
    },
  };

  const deltaElAdvantage = Math.max(0, data.ours.el_removed - data.naive.el_removed);

  return (
    <div className="rounded-2xl bg-slate-900 border border-indigo-500/30 p-6 shadow-xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-1/4 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold mb-2">
          <span>🔬</span> Novelty Proof: Interaction-Aware Planning
        </div>
        <h3 className="text-lg font-bold text-white">Why Graph Analysis Beats Standalone Checklists</h3>
        <p className="text-xs text-slate-400 mt-1">
          Standard security tools score each account independently without seeing recovery chains or chokepoints.
        </p>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Column 1: Naive Per-Account Checklist */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Per-Account Checklist
                </span>
                <span className="text-sm font-bold text-slate-300">"Independent Scorer"</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Projected Score</span>
                <span className="text-base font-bold text-slate-300 font-mono">
                  {data.naive.score_after}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Recommends hardening isolated apps first because it ignores SIM swaps & recovery backdoors:
            </p>

            <ul className="space-y-2 mb-4">
              {data.naive.plan.map((fixId, idx) => (
                <li
                  key={idx}
                  className="text-xs p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-mono flex items-center gap-2"
                >
                  <span className="text-slate-600 font-semibold">{idx + 1}.</span>
                  <span>{fixId}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Risk Removed (EL):</span>
            <span className="font-semibold text-slate-300 font-mono">−{data.naive.el_removed} pts</span>
          </div>
        </div>

        {/* Column 2: Chokepoint Engine */}
        <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/40 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-cyan-800/40 mb-3">
              <div>
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider block">
                  Chokepoint Attack Graph
                </span>
                <span className="text-sm font-bold text-white">"Correlated CTP Engine"</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Projected Score</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {data.ours.score_after}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-3">
              Cuts critical entry chokepoints that eliminate multiple downstream cascades at once:
            </p>

            <ul className="space-y-2 mb-4">
              {data.ours.plan.map((fixId, idx) => (
                <li
                  key={idx}
                  className="text-xs p-2 rounded-lg bg-slate-900/90 border border-cyan-500/30 text-cyan-200 font-mono flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-500 font-semibold">{idx + 1}.</span>
                    <span>{fixId}</span>
                  </div>
                  {onApplyFix && (
                    <button
                      onClick={() => onApplyFix(fixId)}
                      className="px-2 py-0.5 rounded bg-cyan-600/30 hover:bg-cyan-600 text-[10px] text-cyan-300 hover:text-white transition-colors"
                    >
                      Apply
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-3 border-t border-cyan-800/40 flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">Risk Removed (EL):</span>
            <span className="font-bold text-emerald-400 font-mono">
              −{data.ours.el_removed} pts (+{deltaElAdvantage.toFixed(1)} better)
            </span>
          </div>
        </div>
      </div>

      {/* Mandatory Caveat Line per PRD §3 and M2-09 */}
      <div className="mt-4 text-[11px] text-slate-500 text-center italic">
        Both plans are scored by our model; this shows interaction effects, not independent validation.
      </div>
    </div>
  );
};
