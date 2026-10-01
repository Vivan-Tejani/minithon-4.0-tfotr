import React, { useState } from 'react';

export interface FixItem {
  id: string;
  type: string;
  title: string;
  target: string;
  effort: 'low' | 'medium' | 'high';
  standalone_gain: number;
  marginal_gain: number;
  score_after: number;
  rank: number;
  in_best3: boolean;
  greedy: boolean;
  note: string | null;
  why: string;
}

export interface PreviewData {
  score_before: number;
  score_after: number;
  d_el: number;
  new_paths?: Array<{
    entries: string[];
    steps: Array<{ node: string; hop: number; via: string }>;
    likelihood: number;
    band: string;
    cut_fix_id: string;
  }>;
  ghost?: {
    nodes: any[];
    edges: any[];
  };
}

interface FixCardProps {
  fix: FixItem;
  baseScore: number;
  onApply: (fixId: string) => Promise<void> | void;
  onPreview?: (fixId: string) => Promise<PreviewData | null> | void;
  onSelectTarget?: (targetId: string) => void;
  isApplying?: boolean;
}

export const FixCard: React.FC<FixCardProps> = ({
  fix,
  baseScore,
  onApply,
  onPreview,
  onSelectTarget,
  isApplying = false,
}) => {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const effortColors = {
    low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const handlePreviewClick = async () => {
    if (showPreview) {
      setShowPreview(false);
      return;
    }
    if (previewResult) {
      setShowPreview(true);
      return;
    }
    if (onPreview) {
      setLoadingPreview(true);
      try {
        const res = await onPreview(fix.id);
        if (res) {
          setPreviewResult(res);
          setShowPreview(true);
        }
      } catch (err) {
        console.error('Failed to preview fix:', err);
      } finally {
        setLoadingPreview(false);
      }
    } else {
      // Fallback inline preview from fix data
      setPreviewResult({
        score_before: baseScore,
        score_after: fix.score_after,
        d_el: -fix.marginal_gain,
      });
      setShowPreview(true);
    }
  };

  const scoreDelta = fix.score_after - baseScore;

  return (
    <div
      id={`fix-card-${fix.id.replace(/:/g, '-')}`}
      className={`relative group rounded-xl border transition-all duration-200 p-5 ${
        fix.in_best3
          ? 'bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-500/5 hover:border-indigo-500/70'
          : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
      }`}
    >
      {fix.in_best3 && (
        <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white tracking-wide shadow-sm">
          TOP 3 RECOMMENDED
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Left Section: Rank + Content */}
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
              fix.in_best3
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            #{fix.rank}
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-100 text-base leading-snug">
                {fix.title}
              </h3>

              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${
                  effortColors[fix.effort]
                }`}
              >
                {fix.effort} effort
              </span>

              {fix.target && (
                <button
                  type="button"
                  id={`target-chip-${fix.id.replace(/:/g, '-')}`}
                  onClick={() => onSelectTarget && onSelectTarget(fix.target)}
                  className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700 hover:border-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  target: {fix.target}
                </button>
              )}
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">{fix.why}</p>

            {/* Interaction note */}
            {fix.note && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mt-1">
                <span>💡</span>
                <span>{fix.note}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Score Impact & Action Buttons */}
        <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Projected score</span>
            <span className="text-lg font-bold text-emerald-400">
              {fix.score_after}{' '}
              <span className="text-xs font-medium text-emerald-500">
                (+{scoreDelta})
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id={`preview-btn-${fix.id.replace(/:/g, '-')}`}
              onClick={handlePreviewClick}
              disabled={loadingPreview}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                showPreview
                  ? 'bg-slate-700 text-white border-slate-600'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {loadingPreview ? '...' : showPreview ? 'Hide' : 'Preview'}
            </button>

            <button
              type="button"
              id={`apply-btn-${fix.id.replace(/:/g, '-')}`}
              onClick={() => onApply(fix.id)}
              disabled={isApplying}
              className="text-xs px-3.5 py-1.5 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isApplying ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Applying...
                </>
              ) : (
                'Apply Fix'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Inline Preview Panel */}
      {showPreview && previewResult && (
        <div
          id={`preview-panel-${fix.id.replace(/:/g, '-')}`}
          className="mt-4 pt-4 border-t border-slate-800/80 bg-slate-950/40 rounded-lg p-3 text-xs text-slate-300 space-y-2 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200">
              Ghost Preview Simulation
            </span>
            <span className="text-emerald-400 font-medium">
              Score: {previewResult.score_before} → {previewResult.score_after} (
              {previewResult.score_after >= previewResult.score_before ? '+' : ''}
              {previewResult.score_after - previewResult.score_before})
            </span>
          </div>

          <p className="text-slate-400">
            Expected risk loss reduced by{' '}
            <strong className="text-slate-200">
              {Math.abs(previewResult.d_el).toFixed(1)} points
            </strong>
            . No changes saved until applied.
          </p>
        </div>
      )}
    </div>
  );
};
