import type { Authority, RunState } from "../../operator/types.ts";

export type { Approval, Authority, RunState, Step } from "../../operator/types.ts";

export const OPERATOR_URL = process.env.NEXT_PUBLIC_OPERATOR_URL ?? "http://localhost:4100";

export interface RunSummary {
  id: string;
  goal: string;
  profileName: string;
  status: RunState["status"];
  createdAt: string;
  outcome: string | null;
  submitted: number;
  target: number;
}

export interface ProfileOption {
  file: string;
  name: string;
  headline: string;
}

export interface Faults {
  submitGlitch: boolean;
  submitHang: boolean;
  expireSessionAfter: number;
  closedJobs: number[];
  mailOutage: boolean;
  slowMs: number;
}

export interface TrackerRow {
  appliedOn: string;
  company: string;
  role: string;
  stipend: number;
  source: string;
  applicationId: string;
  status: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(OPERATOR_URL + path, {
      ...init,
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("Can't reach the operator API. Is `npm run dev` running?");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

const post = <T>(path: string, body: unknown = {}) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  health: () => call<{ llm: "groq" | "rules"; model: string | null; activeRun: string | null }>("/api/health"),
  profiles: () => call<ProfileOption[]>("/api/profiles"),
  runs: () => call<RunSummary[]>("/api/runs"),
  run: (id: string) => call<RunState>(`/api/runs/${id}`),
  start: (goal: string, profilePath: string, authority: Authority) => post<{ id: string }>("/api/runs", { goal, profilePath, authority }),
  pause: (id: string) => post(`/api/runs/${id}/pause`),
  resume: (id: string) => post(`/api/runs/${id}/resume`),
  stop: (id: string) => post(`/api/runs/${id}/stop`),
  restart: (id: string) => post(`/api/runs/${id}/restart`),
  answer: (id: string, approvalId: string, value: string, text?: string) => post(`/api/runs/${id}/approvals/${approvalId}`, { value, text }),
  tracker: (profile: string) => call<{ path: string; rows: TrackerRow[] }>(`/api/tracker?profile=${encodeURIComponent(profile)}`),
  faults: () => call<Faults>("/api/sandbox/faults"),
  setFaults: (patch: Partial<Faults>) => post<Faults>("/api/sandbox/faults", patch),
  resetDemo: () => post<{ ok: boolean; log: string }>("/api/sandbox/reset"),
};

export const fileUrl = (runId: string, relative: string) => `${OPERATOR_URL}/runs/${runId}/${relative}`;

export function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function whenOf(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export const statusLabel: Record<RunState["status"], string> = {
  running: "Running",
  paused: "Paused",
  waiting: "Needs you",
  completed: "Goal met",
  incomplete: "Incomplete",
  stopped: "Stopped",
  failed: "Failed",
  interrupted: "Interrupted",
};
