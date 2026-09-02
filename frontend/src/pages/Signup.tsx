import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { fetchInviteInfo, type InviteInfoResponse } from '../api/users.js';

interface SignupProps {
  onSwitchToLogin?: () => void;
}

export default function Signup({ onSwitchToLogin }: SignupProps) {
  const { signup } = useAuth();

  // Check URL query parameters for invite token
  const searchParams = new URLSearchParams(window.location.search);
  const inviteToken = searchParams.get('invite')?.trim() || null;

  // Invite state
  const [inviteInfo, setInviteInfo] = useState<InviteInfoResponse | null>(null);
  const [inviteLoading, setInviteLoading] = useState<boolean>(Boolean(inviteToken));
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Submission state
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch invitation info if token is in URL
  useEffect(() => {
    if (!inviteToken) return;

    let cancelled = false;
    setInviteLoading(true);
    setInviteError(null);

    fetchInviteInfo(inviteToken)
      .then((info) => {
        if (cancelled) return;
        setInviteInfo(info);
        setEmail(info.email);
        setInviteLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setInviteError(err instanceof Error ? err.message : 'Invalid or expired invitation token');
        setInviteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    if (!inviteToken && !orgName.trim()) {
      setError('Please provide an organization name.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (inviteToken) {
        await signup({
          name: name.trim(),
          email: email.trim(),
          password,
          inviteToken,
        });
        window.history.replaceState({}, document.title, '/');
      } else {
        await signup({
          name: name.trim(),
          orgName: orgName.trim(),
          email: email.trim(),
          password,
        });
        window.history.replaceState({}, document.title, '/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Loading invite validation state
  if (inviteLoading) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-md rounded-card border border-border-default bg-bg-surface p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          <h2 className="text-base font-semibold text-text-primary">Validating Team Invitation…</h2>
          <p className="mt-1 text-xs text-text-secondary">Verifying secure token and organization details.</p>
        </div>
      </div>
    );
  }

  // Invalid / Expired invite token state
  if (inviteToken && inviteError) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-md rounded-card border border-severity-critical/40 bg-bg-surface p-6 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-severity-critical/10 text-xl text-severity-critical">
              ⚠
            </span>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Invitation Unavailable</h2>
              <p className="text-xs text-severity-critical">{inviteError}</p>
            </div>
          </div>

          <p className="mb-6 text-xs text-text-secondary">
            This invitation link may have expired (72-hour window), been revoked, or already accepted. Please request a new invite from your organization's SOC administrator.
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                window.location.href = window.location.pathname;
              }}
              className="w-full rounded bg-accent-primary px-4 py-2 text-xs font-semibold text-bg-base transition-opacity hover:opacity-90"
            >
              Create a New Organization Instead
            </button>
            {onSwitchToLogin && (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="w-full rounded border border-border-default bg-bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg-surface-raised hover:text-text-primary"
              >
                Return to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-card border border-border-default bg-bg-surface p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="severity-rail border-accent-primary pl-2 text-2xl font-semibold text-text-primary">
              Grid&nbsp;Sentry
            </span>
          </div>
          <span className="rounded bg-bg-surface-raised px-2.5 py-1 text-xs font-mono font-medium text-accent-primary border border-border-default">
            {inviteInfo ? 'INVITATION ACCEPTANCE' : 'NEW ORGANIZATION'}
          </span>
        </div>

        {/* Dynamic Context Banner */}
        {inviteInfo ? (
          <div className="mb-5 rounded border border-accent-primary/40 bg-accent-primary/10 p-3.5 text-xs text-text-primary">
            <p className="font-semibold text-accent-primary flex items-center gap-1.5 mb-1">
              <span>🏢</span> You've been invited to join <strong>{inviteInfo.orgName}</strong>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-text-secondary">Assigned Role:</span>
              <span className="rounded bg-bg-surface px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-accent-primary border border-border-default">
                {inviteInfo.role}
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded border border-border-default bg-bg-base/60 p-3 text-xs text-text-secondary">
            <p className="flex items-center gap-1.5 font-medium text-text-primary mb-1">
              <span className="text-accent-primary">⭐</span> Founding Administrator Account
            </p>
            Registering a new organization creates an isolated multi-tenant tenant with full administrative privileges. Teammates can be invited once your organization is created.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-medium text-text-secondary">
              Full Name *
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Alex Mercer"
              className="w-full rounded border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:border-accent-primary focus:outline-none"
            />
          </div>

          {/* Organization Name (Only if not signing up through an invite) */}
          {!inviteInfo && (
            <div>
              <label htmlFor="orgName" className="mb-1 block text-xs font-medium text-text-secondary">
                Organization / Company Name *
              </label>
              <input
                id="orgName"
                type="text"
                autoComplete="organization"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                placeholder="e.g. CyberDefense SOC, Acme Security"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:border-accent-primary focus:outline-none"
              />
            </div>
          )}

          {/* Email Address */}
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-text-secondary">
              Email Address {inviteInfo ? '(Locked by invitation)' : '*'}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={Boolean(inviteInfo)}
              placeholder="analyst@domain.com"
              className={`w-full rounded border border-border-default px-3 py-2 font-mono text-sm text-text-primary placeholder-text-disabled focus:outline-none ${
                inviteInfo ? 'bg-bg-surface-raised cursor-not-allowed text-text-secondary' : 'bg-bg-base focus:border-accent-primary'
              }`}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-text-secondary">
              Password <span className="text-[10px] text-text-disabled">(min 8 characters)</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••••••"
              className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-text-primary placeholder-text-disabled focus:border-accent-primary focus:outline-none"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-xs font-medium text-text-secondary">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••••••"
              className={`w-full rounded border bg-bg-base px-3 py-2 font-mono text-sm text-text-primary placeholder-text-disabled focus:outline-none ${
                confirmPassword && confirmPassword !== password
                  ? 'border-severity-critical focus:border-severity-critical'
                  : 'border-border-default focus:border-accent-primary'
              }`}
            />
          </div>

          {error && (
            <div className="rounded border border-severity-critical/40 bg-severity-critical/10 p-3">
              <p role="alert" className="text-xs font-medium text-severity-critical">
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-accent-primary px-4 py-2.5 text-sm font-semibold text-bg-base transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? 'Creating account…'
              : inviteInfo
                ? `Accept Invitation & Join ${inviteInfo.orgName}`
                : 'Create Organization & Sign In'}
          </button>
        </form>

        {onSwitchToLogin && (
          <div className="mt-6 border-t border-border-default pt-4 text-center">
            <p className="text-xs text-text-secondary">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-medium text-accent-primary hover:underline focus:outline-none"
              >
                Sign in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
