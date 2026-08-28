/**
 * MITRE ATT&CK API Client (TICKET-010).
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export interface MitreTechniqueHit {
  id: string;
  name: string;
  tacticId: string;
  tacticName: string;
  description: string;
  alertCount: number;
  maxSeverity: string | null;
  intensity: number;
}

export interface MitreTacticMatrixItem {
  id: string;
  name: string;
  description: string;
  totalAlerts: number;
  techniques: MitreTechniqueHit[];
}

export interface MitreMatrixResponse {
  lookbackHours: number;
  totalDetections: number;
  tactics: MitreTacticMatrixItem[];
}

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function fetchMitreMatrix(
  authFetch: AuthFetch,
  lookbackHours = 24,
): Promise<MitreMatrixResponse> {
  const res = await authFetch(`/mitre/matrix?lookbackHours=${lookbackHours}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch MITRE matrix (${res.status})`);
  }
  const data = (await res.json()) as { data: MitreMatrixResponse };
  return data.data;
}
