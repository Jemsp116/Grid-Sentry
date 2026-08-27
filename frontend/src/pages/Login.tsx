import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext.js';

export default function Login() {
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
      <div className="w-full max-w-sm rounded-card border border-border-default bg-bg-surface p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="severity-rail border-accent-primary pl-2 text-2xl font-semibold">
            Grid&nbsp;Sentry
          </span>
        </div>
        <p className="mb-6 text-sm text-text-secondary">
          Sign in to the security operations console.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 font-mono text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs text-text-secondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 font-mono text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-severity-critical">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-accent-primary px-4 py-2.5 text-sm font-semibold text-bg-base transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
