import React from "react";

export interface Spof {
  id: string;
  label: string;
  kind: "entry" | "group" | "account" | string;
  falls: number;
  falls_ids: string[];
  d_el: number;
}

export interface SpofPanelProps {
  spofs: Spof[];
  onHighlight?: (fallsIds: string[]) => void;
  onSelectSpof?: (spof: Spof) => void;
  selectedSpofId?: string | null;
}

export const SpofPanel: React.FC<SpofPanelProps> = ({
  spofs,
  onHighlight,
  onSelectSpof,
  selectedSpofId,
}) => {
  const topSpofs = spofs.slice(0, 5);
  const maxDel = Math.max(...topSpofs.map((s) => s.d_el), 1.0);

  const getKindIcon = (kind: string, id: string) => {
    if (kind === "entry" || id === "E_SIM") {
      return (
        <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </span>
      );
    }
    if (kind === "group" || id.startsWith("GROUP:")) {
      return (
        <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </span>
      );
    }
    return (
      <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </span>
    );
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            Single Points of Failure (SPOFs)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Single items that compromise the largest cascade of your accounts
          </p>
        </div>
        <span className="text-xs text-slate-500 font-mono">Top {topSpofs.length}</span>
      </div>

      {topSpofs.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
          No critical single points of failure detected in current graph.
        </div>
      ) : (
        <div className="space-y-2.5">
          {topSpofs.map((spof) => {
            const isSelected = selectedSpofId === spof.id;
            const barWidthPct = Math.min(100, Math.max(10, Math.round((spof.d_el / maxDel) * 100)));

            const handleClick = () => {
              if (onSelectSpof) onSelectSpof(spof);
              if (onHighlight) onHighlight(spof.falls_ids);
            };

            return (
              <div
                key={spof.id}
                onClick={handleClick}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-slate-800/90 border-cyan-500 shadow-md ring-1 ring-cyan-500/50"
                    : "bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getKindIcon(spof.kind, spof.id)}
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-slate-200 block truncate">
                        {spof.label}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="text-rose-400 font-medium">Falls {spof.falls} {spof.falls === 1 ? "account" : "accounts"}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-400">ΔEL +{spof.d_el}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onHighlight) onHighlight(spof.falls_ids);
                    }}
                    title="Highlight cascade on graph"
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-cyan-600/20 text-cyan-400 border border-slate-700 hover:border-cyan-500/40 transition-colors shrink-0"
                  >
                    Highlight
                  </button>
                </div>

                {/* ΔEL Impact Bar */}
                <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-rose-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${barWidthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
