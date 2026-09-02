import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type Role = 'viewer' | 'analyst' | 'admin';
export interface User {
  id: number;
  name?: string;
  email: string;
  role: Role;
  orgId?: string;
}

export interface SignupParams {
  name: string;
  email: string;
  password: string;
  orgName?: string;
  inviteToken?: string;
}

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  signup: (params: SignupParams) => Promise<void>;
  logout: () => Promise<void>;
  /** fetch() that attaches the access token and transparently refreshes once on 401. */
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

// Dev-only escape hatch: when VITE_DISABLE_AUTH=true the login gate is skipped
// and the app boots as this synthetic admin. Flip the flag off in frontend/.env
// (or remove it) to restore real authentication. Never ship a build with this on.
const AUTH_DISABLED = import.meta.env.VITE_DISABLE_AUTH === 'true';
const DEV_USER: User = { id: 0, email: 'dev@gridsentry.local', role: 'admin' };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(AUTH_DISABLED ? DEV_USER : null);
  const [status, setStatus] = useState<Status>(AUTH_DISABLED ? 'authenticated' : 'loading');
  // Access token lives in memory only (never localStorage) — the refresh token
  // is an httpOnly cookie the JS can't read, which is the XSS-resistant design.
  const tokenRef = useRef<string | null>(null);

  const setToken = (t: string | null) => {
    tokenRef.current = t;
  };

  /** Ask the server for a new access token using the refresh cookie. */
  const doRefresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string };
      setToken(data.accessToken);
      return true;
    } catch {
      return false;
    }
  }, []);

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const withAuth = (): RequestInit => ({
        ...init,
        credentials: 'include',
        headers: {
          ...(init.headers ?? {}),
          ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
        },
      });

      let res = await fetch(`${API_BASE}${path}`, withAuth());
      if (res.status === 401 && (await doRefresh())) {
        res = await fetch(`${API_BASE}${path}`, withAuth());
      }
      return res;
    },
    [doRefresh],
  );

  const loadMe = useCallback(async (): Promise<User | null> => {
    const res = await authFetch('/auth/me');
    if (!res.ok) return null;
    const data = (await res.json()) as { user: User };
    return data.user;
  }, [authFetch]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      throw new Error(body?.error?.message ?? 'Login failed');
    }
    const data = (await res.json()) as { accessToken: string; user: User };
    setToken(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const signup = useCallback(async (params: SignupParams) => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      throw new Error(body?.error?.message ?? 'Sign up failed');
    }
    const data = (await res.json()) as { accessToken: string; user: User };
    setToken(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    if (AUTH_DISABLED) return; // no real session to end while the auth gate is bypassed
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      setToken(null);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  // On first load, try to silently restore a session from the refresh cookie.
  useEffect(() => {
    if (AUTH_DISABLED) return; // dev bypass — skip silent session restore
    let cancelled = false;
    (async () => {
      const ok = await doRefresh();
      if (cancelled) return;
      if (!ok) {
        setStatus('anonymous');
        return;
      }
      const me = await loadMe();
      if (cancelled) return;
      if (me) {
        setUser(me);
        setStatus('authenticated');
      } else {
        setStatus('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doRefresh, loadMe]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, signup, logout, authFetch }),
    [user, status, login, signup, logout, authFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
