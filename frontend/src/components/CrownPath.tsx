import React from "react";
import type { Path } from "./AccountDetail";

export interface CrownPathProps {
  crownPath: {
    target: string;
    path: Path | null;
  } | null;
  targetName?: string;
  onCutPath?: (fixId: string) => void;
  onSelectAccount?: (id: string) => void;
  onOpenPreview?: (fixId: string) => void;
}

export const CrownPath: React.FC<CrownPathProps> = ({
  crownPath,
  targetName,
  onCutPath,
  onSelectAccount,
  onOpenPreview,
}) => {
  if (!crownPath || !crownPath.path) {
    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>👑</span> Crown Jewel Attack Path
        </h3>
        <p className="text-xs text-slate-500 mt-2">
          No active attack paths identified into high-value target accounts.
        </p>
      </div>
    );
  }

  const { target, path } = crownPath;
  const displayName = targetName || target;
  const pathPct = Math.round(path.likelihood * 100);

  const bandColors = {
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    high: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/30 p-5 shadow-xl relative overflow-hidden">
      {/* Background glow accent */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between gap-3 mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">👑</span>
          <div>
            <h3 className="text-base font-bold text-white">
              Easiest Way Into{" "}
              <button
                onClick={() => onSelectAccount && onSelectAccount(target)}
                className="underline decoration-amber-400/50 hover:decoration-amber-400 text-amber-300 font-semibold"
              >
                {displayName}
              </button>
            </h3>
            <p className="text-xs text-slate-400">
              Highest-impact crown jewel attack chain identified by the simulator
            </p>
          </div>
        </div>

        <span
          title={`Path likelihood: ${pathPct}% (model-based estimate)`}
          className={`text-xs px-2.5 py-1 rounded-full border font-semibold tracking-wide uppercase ${bandColors[path.band]}`}
        >
          {path.band} ({pathPct}%)
        </span>
      </div>

      {/* Step chain visualization */}
      <div className="my-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 relative z-10">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Attack Sequence:
        </div>
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {path.entries.map((entry, idx) => (
            <React.Fragment key={`entry-${idx}`}>
              <span className="px-2.5 py-1 rounded-md bg-rose-950/70 text-rose-300 border border-rose-800/50 font-mono text-xs shadow-sm">
                {entry}
              </span>
              <span className="text-slate-500 font-bold">→</span>
            </React.Fragment>
          ))}
          {path.steps.map((step, idx) => (
            <React.Fragment key={`step-${idx}`}>
              <button
                onClick={() => onSelectAccount && onSelectAccount(step.node)}
                title={step.via}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-colors hover:border-slate-500"
              >
                {step.node}
              </button>
              {idx < path.steps.length - 1 && (
                <span className="text-slate-500 font-bold">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Recommended action footer */}
      {path.cut_fix_id && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 relative z-10">
          <div className="text-xs text-slate-300 flex items-center gap-1.5">
            <span className="text-emerald-400 font-semibold">Recommended Fix:</span>
            <code className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[11px] font-mono border border-slate-700">
              {path.cut_fix_id}
            </code>
          </div>

          <div className="flex items-center gap-2">
            {onOpenPreview && (
              <button
                onClick={() => onOpenPreview(path.cut_fix_id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                Preview Fix
              </button>
            )}
            {onCutPath && (
              <button
                onClick={() => onCutPath(path.cut_fix_id)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 transition-all hover:scale-[1.02]"
              >
                Cut This Path
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
