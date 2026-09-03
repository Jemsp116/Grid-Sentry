/**
 * SourceSelector — a compact, styled dropdown that lets users scope
 * the OPERATIONS section to a specific connected source.
 *
 * Renders a pill showing the currently selected source's status dot,
 * app name, and a caret. Clicking opens a styled dropdown list.
 */

import { useEffect, useRef, useState } from 'react';
import { ALL_SOURCES_ID, useSource } from '../context/SourceContext.js';
import type { ApiKeyItem } from '../api/apiKeys.js';

function sourceStatusDot(k: ApiKeyItem): string {
  if (!k.is_active) return 'bg-text-disabled';
  if (!k.last_used_at && !k.first_event_at) return 'bg-accent-primary animate-pulse';
  const hoursSince =
    (Date.now() - new Date(k.last_used_at ?? 0).getTime()) / (1000 * 60 * 60);
  if (hoursSince <= 24) return 'bg-severity-resolved';
  return 'bg-severity-medium';
}

function sourceStatusLabel(k: ApiKeyItem): string {
  if (!k.is_active) return 'Revoked';
  if (!k.last_used_at && !k.first_event_at) return 'Waiting';
  const hoursSince =
    (Date.now() - new Date(k.last_used_at ?? 0).getTime()) / (1000 * 60 * 60);
  if (hoursSince <= 24) return 'Active';
  return 'Idle';
}

export default function SourceSelector() {
  const { sources, selectedSourceId, selectedSource, setSelectedSourceId, loadingSources } =
    useSource();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label =
    selectedSourceId === ALL_SOURCES_ID
      ? 'All Sources'
      : (selectedSource?.app_name ?? 'Unknown Source');

  return (
    <div className="relative" ref={ref}>
      {/* Trigger pill */}
      <button
        id="source-selector-trigger"
        onClick={() => setOpen((v) => !v)}
        disabled={loadingSources}
        className={`
          flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium
          transition-all select-none
          ${open
            ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
            : 'border-border-default bg-bg-surface text-text-secondary hover:border-accent-primary/50 hover:text-text-primary'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* Status dot */}
        {selectedSourceId === ALL_SOURCES_ID ? (
          <span className="flex items-center gap-1 font-mono text-[10px] text-text-disabled">
            🔌
          </span>
        ) : selectedSource ? (
          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${sourceStatusDot(selectedSource)}`} />
        ) : null}

        <span className="max-w-[160px] truncate">{loadingSources ? 'Loading…' : label}</span>

        {/* Badge showing source count */}
        {selectedSourceId === ALL_SOURCES_ID && !loadingSources && sources.length > 0 && (
          <span className="rounded bg-bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-text-disabled border border-border-default">
            {sources.length}
          </span>
        )}

        {/* Caret */}
        <svg
          className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown list */}
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border-default bg-bg-surface shadow-2xl"
          style={{ animation: 'fadeSlideIn 0.12s ease-out' }}
        >
          {/* All Sources option */}
          <button
            role="option"
            aria-selected={selectedSourceId === ALL_SOURCES_ID}
            onClick={() => { setSelectedSourceId(ALL_SOURCES_ID); setOpen(false); }}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-xs transition-colors text-left
              ${selectedSourceId === ALL_SOURCES_ID
                ? 'bg-accent-primary/10 text-accent-primary'
                : 'text-text-secondary hover:bg-bg-surface-raised hover:text-text-primary'
              }`}
          >
            <span className="text-base">🌐</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">All Sources</p>
              <p className="font-mono text-[10px] text-text-disabled">
                Aggregate view across {sources.length} connected source{sources.length !== 1 ? 's' : ''}
              </p>
            </div>
            {selectedSourceId === ALL_SOURCES_ID && (
              <svg className="h-3.5 w-3.5 flex-shrink-0 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {sources.length > 0 && (
            <div className="border-t border-border-default">
              <div className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-disabled">
                Connected Projects
              </div>
              {sources.map((k) => {
                const isSelected = String(k.id) === selectedSourceId;
                const dot = sourceStatusDot(k);
                const statusLabel = sourceStatusLabel(k);
                return (
                  <button
                    key={k.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => { setSelectedSourceId(String(k.id)); setOpen(false); }}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-xs transition-colors text-left
                      ${isSelected
                        ? 'bg-accent-primary/10 text-accent-primary'
                        : 'text-text-secondary hover:bg-bg-surface-raised hover:text-text-primary'
                      }`}
                  >
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary truncate">{k.app_name}</p>
                      <p className="font-mono text-[10px] text-text-disabled">
                        {statusLabel} ·{' '}
                        {k.event_count != null ? `${k.event_count.toLocaleString()} events` : 'No events yet'} ·{' '}
                        {k.connection_method === 'agent' ? 'Log Shipper' : 'Code SDK'}
                      </p>
                    </div>
                    {isSelected && (
                      <svg className="h-3.5 w-3.5 flex-shrink-0 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {sources.length === 0 && !loadingSources && (
            <div className="px-4 py-4 text-center text-xs text-text-disabled">
              No connected sources found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
