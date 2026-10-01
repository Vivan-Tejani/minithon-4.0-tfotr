import React, { useEffect, useState } from "react";

export interface PathStep {
  node: string;
  hop: number;
  via: string;
}

export interface Path {
  entries: string[];
  steps: PathStep[];
  likelihood: number;
  band: "low" | "medium" | "high";
  cut_fix_id: string;
}

export interface AccountDetailProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string | null;
  accountData?: {
    id: string;
    name: string;
    p: number;
    band: "low" | "medium" | "high";
    impact: number;
    why: string;
    reasons: string[];
    top_paths?: Path[];
  } | null;
  unlockedAccounts?: string[];
  onCutPath?: (fixId: string) => void;
  onOpenPreview?: (fixId: string) => void;
}

export const AccountDetail: React.FC<AccountDetailProps> = ({
  isOpen,
  onClose,
  accountId,
  accountData,
  unlockedAccounts = [],
  onCutPath,
  onOpenPreview,
}) => {
  const [paths, setPaths] = useState<Path[]>(accountData?.top_paths || []);
  const [loadingPaths, setLoadingPaths] = useState(false);

  useEffect(() => {
    if (accountData?.top_paths && accountData.top_paths.length > 0) {
      setPaths(accountData.top_paths);
      return;
    }

    if (isOpen && accountId) {
      setLoadingPaths(true);
      fetch(`/api/paths/${accountId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch paths");
          return res.json();
        })
        .then((data) => {
          if (data && Array.isArray(data.paths)) {
            setPaths(data.paths);
          }
        })
        .catch(() => {
          // Graceful fallback to empty
          setPaths([]);
        })
        .finally(() => {
          setLoadingPaths(false);
        });
    }
  }, [isOpen, accountId, accountData]);

  if (!isOpen || !accountId) return null;

  const band = accountData?.band || "medium";
  const p = accountData?.p !== undefined ? accountData.p : 0.25;
  const pct = Math.round(p * 100);
  const impact = accountData?.impact ?? 5;
  const name = accountData?.name || accountId;

  const bandColors = {
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    high: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pl-10">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-screen max-w-md bg-slate-900 border-l border-slate-800 text-slate-100 shadow-2xl flex flex-col h-full z-10 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-950/40">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-white">{name}</h2>
              <span
                title={`Exact takeover probability: ${pct}% (model-based estimate)`}
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium border uppercase tracking-wider ${bandColors[band]}`}
              >
                {band} ({pct}%)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>Account ID: <code className="text-slate-300">{accountId}</code></span>
              <span>•</span>
              <span className="text-amber-400/90 font-medium">Impact: {impact}/10</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Why Section */}
          {accountData?.why && (
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Risk Explanation
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed">{accountData.why}</p>
            </div>
          )}

          {/* Reasons Chips */}
          {accountData?.reasons && accountData.reasons.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Contributing Factors</h3>
              <div className="flex flex-wrap gap-1.5">
                {accountData.reasons.map((reason, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ways In / Attack Paths */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Ways In (Attack Routes)
              </h3>
              <span className="text-[10px] text-slate-500">Top {paths.length} minimal paths</span>
            </div>

            {loadingPaths ? (
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 animate-pulse text-xs text-slate-400 text-center">
                Computing attack paths...
              </div>
            ) : paths.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 text-xs text-slate-400 text-center">
                No external takeover paths found directly into this account.
              </div>
            ) : (
              <div className="space-y-3">
                {paths.map((path, idx) => {
                  const pathPct = Math.round(path.likelihood * 100);
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-slate-400">Path #{idx + 1}</span>
                        <span
                          title={`Path likelihood: ${pathPct}%`}
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${bandColors[path.band]}`}
                        >
                          {path.band} ({pathPct}%)
                        </span>
                      </div>

                      {/* Step Chain */}
                      <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-200 mb-3">
                        {path.entries.map((entry, eIdx) => (
                          <React.Fragment key={`entry-${eIdx}`}>
                            <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 font-mono text-[11px] border border-rose-800/40">
                              {entry}
                            </span>
                            <span className="text-slate-500">→</span>
                          </React.Fragment>
                        ))}
                        {path.steps.map((step, sIdx) => (
                          <React.Fragment key={`step-${sIdx}`}>
                            <span
                              title={step.via}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-medium text-[11px] border border-slate-700 hover:border-slate-600 transition-colors"
                            >
                              {step.node}
                            </span>
                            {sIdx < path.steps.length - 1 && (
                              <span className="text-slate-500">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Actions */}
                      {path.cut_fix_id && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                          <span className="text-[11px] text-slate-400">
                            Recommended fix: <code className="text-cyan-300 font-mono text-[10px]">{path.cut_fix_id}</code>
                          </span>
                          <div className="flex items-center gap-1.5">
                            {onOpenPreview && (
                              <button
                                onClick={() => onOpenPreview(path.cut_fix_id)}
                                className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                              >
                                Preview
                              </button>
                            )}
                            {onCutPath && (
                              <button
                                onClick={() => onCutPath(path.cut_fix_id)}
                                className="px-2.5 py-1 text-[11px] rounded font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                              >
                                Cut Path
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* What This Account Can Unlock */}
          {unlockedAccounts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                What This Account Can Unlock ({unlockedAccounts.length})
              </h3>
              <p className="text-xs text-slate-400 mb-2">
                If this account is compromised, the following connected accounts fall:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unlockedAccounts.map((depId, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-1 rounded-md bg-amber-950/40 text-amber-300 border border-amber-800/40 font-medium"
                  >
                    {depId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-500 text-center">
          Model-based estimate, not a measured probability. Data stays on this device.
        </div>
      </div>
    </div>
  );
};
