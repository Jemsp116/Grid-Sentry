import { useAuth } from './context/AuthContext.js';
import Login from './pages/Login.js';
import Overview from './pages/Overview.js';

export default function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="font-mono text-sm text-text-secondary">Loading…</p>
      </div>
    );
  }

  return status === 'authenticated' ? <Overview /> : <Login />;
}
