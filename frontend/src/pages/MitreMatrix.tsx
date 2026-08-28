import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchMitreMatrix,
  type MitreMatrixResponse,
  type MitreTechniqueHit,
} from '../api/mitre.js';

export default function MitreMatrix() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [lookbackHours, setLookbackHours] = useState(168); // Default 7d
  const [data, setData] = useState<MitreMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTech, setSelectedTech] = useState<MitreTechniqueHit | null>(null);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMitreMatrix(authFetch, lookbackHours);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MITRE ATT&CK matrix');
    } finally {
      setLoading(false);
    }
  }, [authFetch, lookbackHours]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  function handleTechniqueClick(tech: MitreTechniqueHit) {
    if (tech.alertCount > 0) {
      // Seamless drill-down: filter Alert Feed by technique ID
      navigate(`/alerts?mitreId=${tech.id}`);
    } else {
      setSelectedTech(tech);
    }
  }

  function getHeatmapBgClass(intensity: number, alertCount: number): string {
    if (alertCount === 0) return 'bg-bg-surface border-border-default/50 text-text-secondary hover:border-border-default';
    if (intensity < 30) return 'bg-severity-medium/15 border-severity-medium/50 text-severity-medium shadow-sm hover:bg-severity-medium/25';
    if (intensity < 70) return 'bg-severity-high/20 border-severity-high/70 text-severity-high shadow-md hover:bg-severity-high/30';
    return 'bg-severity-critical/25 border-severity-critical text-severity-critical font-bold shadow-lg animate-pulse hover:bg-severity-critical/35';
  }

  return (
    <div className="space-y-6">
      {/* Header & Lookback Pills */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            MITRE ATT&CK® Threat Heatmap Matrix
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Visual breakdown of detected adversary tactics and techniques mapped against the Enterprise framework.
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex rounded border border-border-default bg-bg-surface p-1">
          {[
            { label: 'Last 24h', hours: 24 },
            { label: 'Last 7d', hours: 168 },
            { label: 'Last 30d', hours: 720 },
            { label: 'All Time', hours: 8760 },
          ].map((preset) => (
            <button
              key={preset.hours}
              onClick={() => setLookbackHours(preset.hours)}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                lookbackHours === preset.hours
                  ? 'bg-accent-primary text-bg-base font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded border border-severity-critical/30 bg-severity-critical/5 px-4 py-3 text-sm text-severity-critical">
          {error}
        </div>
      )}

      {/* Summary Banner */}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border-default bg-bg-surface p-4 text-xs font-mono">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-text-secondary">Total Detections: </span>
              <span className="font-bold text-accent-primary">{data.totalDetections}</span>
            </div>
            <div>
              <span className="text-text-secondary">Monitored Tactics: </span>
              <span className="font-bold text-text-primary">{data.tactics.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-text-secondary">Heat Legend:</span>
            <span className="rounded bg-bg-surface border border-border-default px-2 py-0.5 text-text-secondary">0 Alerts</span>
            <span className="rounded bg-severity-medium/15 border border-severity-medium/50 px-2 py-0.5 text-severity-medium">Low Heat</span>
            <span className="rounded bg-severity-high/20 border border-severity-high/70 px-2 py-0.5 text-severity-high">High Heat</span>
            <span className="rounded bg-severity-critical/25 border border-severity-critical px-2 py-0.5 text-severity-critical font-bold">Critical Heat</span>
          </div>
        </div>
      )}

      {/* Heatmap Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
        </div>
      ) : !data || data.tactics.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-border-default bg-bg-surface py-20 text-center">
          <div className="mb-4 text-4xl opacity-30">🛡</div>
          <h3 className="text-sm font-semibold text-text-primary">No MITRE ATT&CK detections found</h3>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
          {data.tactics.map((tactic) => (
            <div key={tactic.id} className="flex flex-col rounded-card border border-border-default bg-bg-surface p-4">
              {/* Tactic Header */}
              <div className="mb-3 border-b border-border-default pb-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-text-primary">{tactic.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                      tactic.totalAlerts > 0
                        ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
                        : 'bg-bg-base text-text-disabled border border-border-default'
                    }`}
                  >
                    {tactic.totalAlerts}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-text-secondary truncate">{tactic.description}</p>
              </div>

              {/* Techniques List */}
              <div className="space-y-2.5 flex-1">
                {tactic.techniques.map((tech) => (
                  <div
                    key={tech.id}
                    onClick={() => handleTechniqueClick(tech)}
                    className={`group relative cursor-pointer rounded border p-3 transition-all ${getHeatmapBgClass(
                      tech.intensity,
                      tech.alertCount,
                    )}`}
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-bold">{tech.id}</span>
                      {tech.alertCount > 0 ? (
                        <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-bold">
                          {tech.alertCount} {tech.alertCount === 1 ? 'alert' : 'alerts'}
                        </span>
                      ) : (
                        <span className="text-[10px] opacity-40">0</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] font-sans font-medium line-clamp-1">
                      {tech.name}
                    </p>

                    {/* Drill-down hint on hover */}
                    {tech.alertCount > 0 && (
                      <div className="mt-2 text-[10px] font-sans opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-between text-accent-primary font-semibold">
                        <span>Click to view alerts →</span>
                        {tech.maxSeverity && (
                          <span className="uppercase font-mono text-[9px]">{tech.maxSeverity}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Technique Modal Details (for zero-count items or overview info) */}
      {selectedTech && selectedTech.alertCount === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 p-4">
          <div className="w-full max-w-md rounded-modal border border-border-default bg-bg-surface-raised p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-accent-primary">{selectedTech.id}</span>
                <h2 className="text-base font-semibold text-text-primary">{selectedTech.name}</h2>
              </div>
              <button
                onClick={() => setSelectedTech(null)}
                className="rounded p-1 text-text-secondary hover:bg-bg-surface hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-text-secondary">
                <strong className="text-text-primary">Tactic:</strong> {selectedTech.tacticName} ({selectedTech.tacticId})
              </p>
              <p className="text-text-secondary">{selectedTech.description}</p>
              <div className="rounded border border-border-default bg-bg-base p-3 font-mono text-[11px] text-text-secondary">
                No alerts detected for technique {selectedTech.id} within the selected lookback window.
              </div>
            </div>

            <div className="flex justify-end border-t border-border-default pt-3">
              <button
                onClick={() => setSelectedTech(null)}
                className="rounded bg-accent-primary px-4 py-1.5 text-xs font-semibold text-bg-base hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
