import { ReactNode } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext.js';

interface ProtectedRouteProps {
  allowedRoles: Role[];
  children: ReactNode;
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
      </div>
    );
  }

  if (status !== 'authenticated' || !user) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center p-8 text-center">
        <div className="w-full max-w-md rounded-card border border-severity-critical/30 bg-bg-surface p-8 shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-severity-critical/10 text-2xl text-severity-critical">
            ⊘
          </div>
          <h2 className="text-xl font-bold text-text-primary">Access Restricted</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Your current account role (<span className="font-mono uppercase font-semibold text-accent-primary">{user.role}</span>) does not have authorization to view this administrative resource.
          </p>
          <div className="mt-4 rounded border border-border-default bg-bg-base p-3 text-xs font-mono text-text-secondary">
            Required role: {allowedRoles.map((r) => r.toUpperCase()).join(' or ')}
          </div>
          <div className="mt-6 flex justify-center">
            <Link
              to="/"
              className="rounded bg-accent-primary px-5 py-2 text-xs font-semibold text-bg-base transition-opacity hover:opacity-90"
            >
              Return to SOC Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
