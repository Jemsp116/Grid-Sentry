/**
 * SourceContext — provides the list of connected sources and the currently
 * selected source to every page in the OPERATIONS section.
 *
 * Selection is persisted in sessionStorage so it survives page navigation
 * but resets on a new browser session.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { fetchApiKeys, type ApiKeyItem } from '../api/apiKeys.js';
import { useAuth } from './AuthContext.js';

export const ALL_SOURCES_ID = '__all__';

interface SourceContextValue {
  /** All active connected source API keys for this org */
  sources: ApiKeyItem[];
  /** Currently selected source id (number) or ALL_SOURCES_ID sentinel */
  selectedSourceId: string;
  /** The full ApiKeyItem for the selected source, or null if "All" */
  selectedSource: ApiKeyItem | null;
  setSelectedSourceId: (id: string) => void;
  loadingSources: boolean;
}

const SourceContext = createContext<SourceContextValue>({
  sources: [],
  selectedSourceId: ALL_SOURCES_ID,
  selectedSource: null,
  setSelectedSourceId: () => {},
  loadingSources: false,
});

const SESSION_KEY = 'gs_selected_source';

export function SourceProvider({ children }: { children: ReactNode }) {
  const { authFetch } = useAuth();
  const [sources, setSources] = useState<ApiKeyItem[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [selectedSourceId, setSelectedSourceIdState] = useState<string>(
    () => sessionStorage.getItem(SESSION_KEY) ?? ALL_SOURCES_ID,
  );

  const setSelectedSourceId = useCallback((id: string) => {
    setSelectedSourceIdState(id);
    sessionStorage.setItem(SESSION_KEY, id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingSources(true);
    fetchApiKeys(authFetch)
      .then((keys) => {
        if (cancelled) return;
        // Only show active sources in the selector
        setSources(keys.filter((k) => k.is_active));
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSources(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const selectedSource =
    selectedSourceId === ALL_SOURCES_ID
      ? null
      : (sources.find((s) => String(s.id) === selectedSourceId) ?? null);

  return (
    <SourceContext.Provider
      value={{
        sources,
        selectedSourceId,
        selectedSource,
        setSelectedSourceId,
        loadingSources,
      }}
    >
      {children}
    </SourceContext.Provider>
  );
}

export function useSource() {
  return useContext(SourceContext);
}
