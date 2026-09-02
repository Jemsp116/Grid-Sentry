import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext.js';

interface LoginProps {
  onSwitchToSignup?: () => void;
}

export default function Login({ onSwitchToSignup }: LoginProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-card border border-border-default bg-bg-surface p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="severity-rail border-accent-primary pl-2 text-2xl font-semibold text-text-primary">
              Grid&nbsp;Sentry
            </span>
          </div>
          <span className="rounded bg-bg-surface-raised px-2.5 py-1 text-xs font-mono font-medium text-text-secondary border border-border-default">
            v1.0
          </span>
        </div>
        <p className="mb-6 text-sm text-text-secondary">
          Sign in to the security operations console.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@gridsentry.local"
              className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-text-primary placeholder-text-disabled focus:border-accent-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-text-secondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••••••"
              className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-sm text-text-primary placeholder-text-disabled focus:border-accent-primary focus:outline-none"
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
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {onSwitchToSignup && (
          <div className="mt-6 border-t border-border-default pt-4 text-center">
            <p className="text-xs text-text-secondary">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToSignup}
                className="font-medium text-accent-primary hover:underline focus:outline-none"
              >
                Create an account
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
