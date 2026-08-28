import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.js';
import Login from './pages/Login.js';
import Overview from './pages/Overview.js';
import LogExplorer from './pages/LogExplorer.js';
import RuleManagement from './pages/RuleManagement.js';
import AlertFeed from './pages/AlertFeed.js';
import AlertDetail from './pages/AlertDetail.js';
import UserManagement from './pages/UserManagement.js';
import IPBlocklist from './pages/IPBlocklist.js';
import AuditLog from './pages/AuditLog.js';
import MitreMatrix from './pages/MitreMatrix.js';
import AppShell from './components/AppShell.js';

export default function App() {
  const { status } = useAuth();

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
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="/alerts" element={<AlertFeed />} />
          <Route path="/alerts/:id" element={<AlertDetail />} />
          <Route path="/mitre" element={<MitreMatrix />} />
          <Route path="/logs" element={<LogExplorer />} />
          <Route path="/rules" element={<RuleManagement />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/blocklist" element={<IPBlocklist />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
