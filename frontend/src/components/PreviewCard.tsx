import React, { useEffect, useState, useRef } from 'react';
import type { PreviewRequest, PreviewResponse } from '../api/types';
import { api } from '../api/client';
import { ShieldAlert, ArrowRight, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';

interface PreviewCardProps {
  request: PreviewRequest | null;
  onGhostChange?: (ghost: any | null) => void;
}

export const PreviewCard: React.FC<PreviewCardProps> = ({ request, onGhostChange }) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!request || (!request.account && !request.fix_id)) {
      setPreview(null);
      if (onGhostChange) onGhostChange(null);
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setLoading(true);
    setError(null);

    // Debounce 400ms per PRD M1-07
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.preview(request);
        setPreview(res);
        if (onGhostChange) {
          onGhostChange(res.ghost);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to preview');
        if (onGhostChange) onGhostChange(null);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [JSON.stringify(request)]);

  useEffect(() => {
    return () => {
      if (onGhostChange) onGhostChange(null);
    };
  }, []);

  if (!request || (!request.account && !request.fix_id)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md transition-all duration-300">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyan-400 animate-pulse" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Ghost Preview (Live Simulation)
          </h4>
        </div>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
            Simulating...
          </span>
        )}
      </div>

      {error ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-rose-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : preview ? (
        <div className="mt-3 space-y-3">
          {/* Score Change Banner */}
          <div className="flex items-center justify-between rounded-lg bg-slate-950/60 p-3 border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-slate-300">{preview.score_before}</span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
                <span
                  className={`text-2xl font-black ${
                    preview.score_after > preview.score_before
                      ? 'text-emerald-400'
                      : preview.score_after < preview.score_before
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}
                >
                  {preview.score_after}
                </span>
              </div>

              {preview.score_after !== preview.score_before ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                    preview.score_after > preview.score_before
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {preview.score_after > preview.score_before ? '+' : ''}
                  {preview.score_after - preview.score_before} pts
                </span>
              ) : (
                <span className="text-xs text-slate-500 italic">No score impact</span>
              )}
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Expected Loss</div>
              <div className="text-xs font-mono font-medium text-slate-300">
                ΔEL: {preview.d_el > 0 ? `+${preview.d_el}` : preview.d_el}
              </div>
            </div>
          </div>

          {/* New Paths in Plain English */}
          {preview.new_paths && preview.new_paths.length > 0 ? (
            <div className="rounded-lg bg-rose-950/20 border border-rose-900/30 p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-rose-300 mb-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                <span>New Takeover Vector Exposed</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Compromising{' '}
                <span className="font-semibold text-rose-300">
                  {preview.new_paths[0].entries.join(', ')}
                </span>{' '}
                would now unlock this account
                {preview.new_paths[0].steps.length > 0 && (
                  <> via {preview.new_paths[0].steps.map((s) => s.node).join(' → ')}</>
                )}
                .
              </p>
            </div>
          ) : preview.score_after > preview.score_before ? (
            <div className="rounded-lg bg-emerald-950/20 border border-emerald-900/30 p-2.5 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-300">
                This modification reduces overall takeover risk and closes attack paths.
              </span>
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-1">
              Saving this change will maintain current attack surface metrics.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
