import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.js';
import Login from './pages/Login.js';
import Signup from './pages/Signup.js';
import Overview from './pages/Overview.js';
import LogExplorer from './pages/LogExplorer.js';
import RuleManagement from './pages/RuleManagement.js';
import AlertFeed from './pages/AlertFeed.js';
import AlertDetail from './pages/AlertDetail.js';
import UserManagement from './pages/UserManagement.js';
import IPBlocklist from './pages/IPBlocklist.js';
import AuditLog from './pages/AuditLog.js';
import MitreMatrix from './pages/MitreMatrix.js';
import ConnectedSources from './pages/ConnectedSources.js';
import DatabaseSettings from './pages/DatabaseSettings.js';
import AppShell from './components/AppShell.js';
import ProtectedRoute from './components/ProtectedRoute.js';

export default function App() {
  const { status } = useAuth();
  
  // Inspect URL for invite parameters or /signup path
  const searchParams = new URLSearchParams(window.location.search);
  const inviteToken = searchParams.get('invite')?.trim() || null;
  const isSignupPath = window.location.pathname === '/signup';

  const [authView, setAuthView] = useState<'login' | 'signup'>(
    inviteToken || isSignupPath ? 'signup' : 'login',
  );

  // If the user arrived with an invite token, prioritize the invite validation screen
  if (inviteToken) {
    return <Signup onSwitchToLogin={() => {
      // Clear invite param from URL if switching to login
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthView('login');
    }} />;
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="flex flex-col items-center gap-[3px]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          <p className="font-mono text-sm text-text-secondary">Loading…</p>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return authView === 'signup' ? (
      <Signup onSwitchToLogin={() => setAuthView('login')} />
    ) : (
      <Login onSwitchToSignup={() => setAuthView('signup')} />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* Universal SOC Routes (Viewer, Analyst, Admin) */}
          <Route index element={<Overview />} />
          <Route path="/alerts" element={<AlertFeed />} />
          <Route path="/alerts/:id" element={<AlertDetail />} />
          <Route path="/mitre" element={<MitreMatrix />} />
          <Route path="/logs" element={<LogExplorer />} />

          {/* Triage & Defense Routes (Analyst & Admin) */}
          <Route
            path="/blocklist"
            element={
              <ProtectedRoute allowedRoles={['analyst', 'admin']}>
                <IPBlocklist />
              </ProtectedRoute>
            }
          />

          {/* Administration Routes (Admin Only) */}
          <Route
            path="/rules"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <RuleManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/connected-sources"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ConnectedSources />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/database"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DatabaseSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AuditLog />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
