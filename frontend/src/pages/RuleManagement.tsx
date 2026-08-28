import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchRules,
  createRule,
  updateRule,
  toggleRule,
  deleteRule,
  dryRunRule,
  type Rule,
  type MatchCondition,
  type SeverityLevel,
  type RuleAction,
  type DryRunResult,
} from '../api/rules.js';

const ALLOWED_FIELDS: Array<{ value: MatchCondition['field']; label: string }> = [
  { value: 'event_type', label: 'event_type' },
  { value: 'outcome', label: 'outcome' },
  { value: 'source_ip', label: 'source_ip' },
  { value: 'ssh_user', label: 'ssh_user' },
  { value: 'raw_message', label: 'raw_message' },
];

const ALLOWED_OPERATORS: Array<{ value: MatchCondition['operator']; label: string }> = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'exists', label: 'exists' },
];

const SEVERITIES: Array<{ value: SeverityLevel; label: string; badgeCls: string }> = [
  { value: 'critical', label: 'Critical', badgeCls: 'border-severity-critical text-severity-critical' },
  { value: 'high', label: 'High', badgeCls: 'border-severity-high text-severity-high' },
  { value: 'medium', label: 'Medium', badgeCls: 'border-severity-medium text-severity-medium' },
  { value: 'low', label: 'Low', badgeCls: 'border-severity-low text-severity-low' },
];

export default function RuleManagement() {
  const { authFetch, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logSource, setLogSource] = useState('ssh_auth');
  const [conditions, setConditions] = useState<MatchCondition[]>([
    { field: 'raw_message', operator: 'contains', value: '' },
  ]);
  const [threshold, setThreshold] = useState(5);
  const [timeWindowSeconds, setTimeWindowSeconds] = useState(60);
  const [severity, setSeverity] = useState<SeverityLevel>('high');
  const [mitreId, setMitreId] = useState('T1110');
  const [actionOnTrigger, setActionOnTrigger] = useState<RuleAction>('alert_only');
  const [isActive, setIsActive] = useState(true);

  // Dry run state
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRules(authFetch);
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  function openCreateModal() {
    setEditingRule(null);
    setName('');
    setDescription('');
    setLogSource('ssh_auth');
    setConditions([{ field: 'raw_message', operator: 'contains', value: '' }]);
    setThreshold(5);
    setTimeWindowSeconds(60);
    setSeverity('high');
    setMitreId('T1110');
    setActionOnTrigger('alert_only');
    setIsActive(true);
    setDryRunResult(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(rule: Rule) {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description ?? '');
    setLogSource(rule.log_source);
    setConditions(rule.match_conditions.length > 0 ? rule.match_conditions : [{ field: 'raw_message', operator: 'contains', value: '' }]);
    setThreshold(rule.threshold);
    setTimeWindowSeconds(rule.time_window_seconds);
    setSeverity(rule.severity);
    setMitreId(rule.mitre_technique_id ?? '');
    setActionOnTrigger(rule.action_on_trigger);
    setIsActive(rule.is_active);
    setDryRunResult(null);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleToggle(rule: Rule) {
    try {
      const updated = await toggleRule(authFetch, rule.id, !rule.is_active);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle rule');
    }
  }

  async function handleDelete(rule: Rule) {
    if (!confirm(`Are you sure you want to delete rule "${rule.name}"?`)) return;
    try {
      await deleteRule(authFetch, rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  }

  function handleAddCondition() {
    setConditions((prev) => [...prev, { field: 'raw_message', operator: 'contains', value: '' }]);
  }

  function handleRemoveCondition(index: number) {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleConditionChange<K extends keyof MatchCondition>(
    index: number,
    key: K,
    val: MatchCondition[K],
  ) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: val } : c)),
    );
  }

  async function handleDryRun() {
    setDryRunLoading(true);
    setFormError(null);
    try {
      const result = await dryRunRule(authFetch, {
        log_source: logSource,
        match_conditions: conditions,
        lookback_hours: 24,
      });
      setDryRunResult(result);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Dry run failed');
    } finally {
      setDryRunLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const payload = {
        name,
        description: description || undefined,
        log_source: logSource,
        match_conditions: conditions,
        threshold: Number(threshold),
        time_window_seconds: Number(timeWindowSeconds),
        severity,
        mitre_technique_id: mitreId || null,
        action_on_trigger: actionOnTrigger,
        is_active: isActive,
      };

      if (editingRule) {
        await updateRule(authFetch, editingRule.id, payload);
      } else {
        await createRule(authFetch, payload);
      }

      setModalOpen(false);
      loadRules();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Detection Rules</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Configure automated rules evaluated against OpenSearch log streams.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="rounded bg-accent-primary px-4 py-2 text-sm font-semibold text-bg-base transition-opacity hover:opacity-90"
          >
            + Create Rule
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded border border-severity-critical/30 bg-severity-critical/5 px-4 py-3 text-sm text-severity-critical">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-border-default bg-bg-surface py-20">
          <div className="mb-4 text-4xl opacity-30">⚙</div>
          <h3 className="text-sm font-semibold text-text-primary">No detection rules found</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Click "+ Create Rule" to define a detection rule.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border-default">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-default bg-bg-surface text-text-secondary">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Rule Name</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Threshold / Window</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">MITRE ID</th>
                <th className="px-4 py-3 font-medium">Action</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const sevInfo = SEVERITIES.find((s) => s.value === rule.severity);
                return (
                  <tr
                    key={rule.id}
                    className={`border-b border-border-default bg-bg-surface transition-colors hover:bg-bg-surface-raised ${
                      rule.severity === 'critical'
                        ? 'severity-rail border-l-severity-critical'
                        : rule.severity === 'high'
                          ? 'severity-rail border-l-severity-high'
                          : rule.severity === 'medium'
                            ? 'severity-rail border-l-severity-medium'
                            : 'severity-rail border-l-severity-low'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    {/* Active toggle */}
                    <td className="whitespace-nowrap px-4 py-3">
                      {isAdmin ? (
                        <button
                          onClick={() => handleToggle(rule)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.is_active ? 'bg-severity-resolved' : 'bg-border-default'
                          }`}
                          aria-label={`Toggle active state for ${rule.name}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-text-primary shadow ring-0 transition duration-200 ease-in-out ${
                              rule.is_active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      ) : (
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            rule.is_active ? 'bg-severity-resolved' : 'bg-text-disabled'
                          }`}
                        />
                      )}
                    </td>

                    {/* Name & description */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-primary">{rule.name}</div>
                      {rule.description && (
                        <div className="text-[11px] text-text-secondary truncate max-w-xs">
                          {rule.description}
                        </div>
                      )}
                    </td>

                    {/* Log source */}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-text-secondary">
                      {rule.log_source}
                    </td>

                    {/* Threshold / Window */}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-text-primary">
                      ≥{rule.threshold} in {rule.time_window_seconds}s
                    </td>

                    {/* Severity */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`severity-rail ${sevInfo?.badgeCls} rounded bg-bg-surface-raised px-2 py-0.5 font-mono text-[11px]`}>
                        {sevInfo?.label ?? rule.severity}
                      </span>
                    </td>

                    {/* MITRE ID */}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-accent-primary">
                      {rule.mitre_technique_id ?? '—'}
                    </td>

                    {/* Action */}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {rule.action_on_trigger === 'alert_and_block_ip' ? (
                        <span className="text-severity-critical">Alert & Block IP</span>
                      ) : (
                        <span className="text-text-secondary">Alert Only</span>
                      )}
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="mr-2 rounded px-2 py-1 text-xs text-accent-primary hover:bg-bg-surface-raised"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          className="rounded px-2 py-1 text-xs text-severity-critical hover:bg-bg-surface-raised"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Rule Builder Modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-modal border border-border-default bg-bg-surface-raised p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border-default pb-3">
              <h2 className="text-lg font-semibold text-text-primary">
                {editingRule ? 'Edit Detection Rule' : 'Create Detection Rule'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-text-secondary hover:bg-bg-surface hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded border border-severity-critical/30 bg-severity-critical/5 px-3 py-2 text-xs text-severity-critical">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Name & Log Source */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-text-secondary">Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. SSH Brute Force"
                    className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-text-secondary">Log Source *</label>
                  <select
                    value={logSource}
                    onChange={(e) => setLogSource(e.target.value)}
                    className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                  >
                    <option value="ssh_auth">ssh_auth (SSH Authentication)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-text-secondary">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional rule description"
                  className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                />
              </div>

              {/* Match Conditions (Constrained DSL Builder) */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="font-semibold text-text-primary">
                    Match Conditions (All must match) *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="text-xs text-accent-primary hover:underline"
                  >
                    + Add Condition
                  </button>
                </div>

                <div className="space-y-2">
                  {conditions.map((cond, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-2 rounded border border-border-default bg-bg-surface p-2"
                    >
                      {/* Field */}
                      <select
                        value={cond.field}
                        onChange={(e) =>
                          handleConditionChange(
                            idx,
                            'field',
                            e.target.value as MatchCondition['field'],
                          )
                        }
                        className="rounded border border-border-default bg-bg-base px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                      >
                        {ALLOWED_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>

                      {/* Operator */}
                      <select
                        value={cond.operator}
                        onChange={(e) =>
                          handleConditionChange(
                            idx,
                            'operator',
                            e.target.value as MatchCondition['operator'],
                          )
                        }
                        className="rounded border border-border-default bg-bg-base px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                      >
                        {ALLOWED_OPERATORS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>

                      {/* Value */}
                      {cond.operator !== 'exists' && (
                        <input
                          type="text"
                          required
                          value={cond.value ?? ''}
                          onChange={(e) =>
                            handleConditionChange(idx, 'value', e.target.value)
                          }
                          placeholder="value"
                          className="flex-1 min-w-[120px] rounded border border-border-default bg-bg-base px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                        />
                      )}

                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(idx)}
                          className="px-1 text-severity-critical hover:opacity-80"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Threshold & Time Window */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-text-secondary">Threshold (Count) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-text-disabled">Minimum occurrences to trigger</p>
                </div>

                <div>
                  <label className="mb-1 block text-text-secondary">Time Window (Seconds) *</label>
                  <input
                    type="number"
                    min={1}
                    max={86400}
                    required
                    value={timeWindowSeconds}
                    onChange={(e) => setTimeWindowSeconds(Number(e.target.value))}
                    className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-text-disabled">Evaluation lookback window</p>
                </div>
              </div>

              {/* Severity & MITRE Technique ID & Action */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-text-secondary">Severity *</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                    className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-text-secondary">MITRE Technique ID</label>
                  <input
                    type="text"
                    value={mitreId}
                    onChange={(e) => setMitreId(e.target.value)}
                    placeholder="e.g. T1110"
                    className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-text-secondary">Action on Trigger *</label>
                  <select
                    value={actionOnTrigger}
                    onChange={(e) => setActionOnTrigger(e.target.value as RuleAction)}
                    className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                  >
                    <option value="alert_only">Alert Only</option>
                    <option value="alert_and_block_ip">Alert & Block IP</option>
                  </select>
                </div>
              </div>

              {/* Dry Run Preview Section */}
              <div className="rounded border border-border-default bg-bg-surface p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-text-primary">Dry Run Preview</h3>
                    <p className="text-[10px] text-text-secondary">
                      Test rule query against historical logs in OpenSearch (last 24 hours).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDryRun}
                    disabled={dryRunLoading}
                    className="rounded border border-accent-primary px-3 py-1.5 font-semibold text-accent-primary transition-colors hover:bg-accent-primary/10 disabled:opacity-50"
                  >
                    {dryRunLoading ? 'Evaluating…' : 'Run Dry Run'}
                  </button>
                </div>

                {dryRunResult && (
                  <div className="mt-3 border-t border-border-default pt-3">
                    <p className="font-mono text-xs text-text-primary">
                      Matched <span className="text-accent-primary font-bold">{dryRunResult.matchedCount}</span> log entries in the last {dryRunResult.lookbackHours}h.
                    </p>
                    {dryRunResult.sampleHits.length > 0 && (
                      <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
                        {dryRunResult.sampleHits.map((hit) => (
                          <div key={hit._id} className="rounded bg-bg-base p-2 font-mono text-[11px] text-text-secondary truncate">
                            {(hit._source.raw_message as string) ?? JSON.stringify(hit._source)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-border-default pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded border border-border-default px-4 py-2 text-text-secondary hover:bg-bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-accent-primary px-4 py-2 font-semibold text-bg-base transition-opacity disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : editingRule ? 'Update Rule' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
