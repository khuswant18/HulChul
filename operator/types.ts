export interface Mission {
  summary: string;
  keywords: string[];
  locations: string[];
  minStipend: number | null;
  postedWithinDays: number | null;
  maxApplications: number;
  excludeCompanies: string[];
  assumptions: string[];
}

export interface Authority {
  maxApplications: number;
  allowFees: boolean;
  allowCommitments: boolean;
  confirmPlan: boolean;
  confirmEachSubmit: boolean;
}

export const defaultAuthority: Authority = {
  maxApplications: 3,
  allowFees: false,
  allowCommitments: false,
  confirmPlan: true,
  confirmEachSubmit: false,
};

export interface JobListing {
  boardId: number;
  url: string;
  title: string;
  company: string;
  location: string;
  mode: string;
  stipendMin: number;
  stipendMax: number;
  postedOn: string;
  deadline: string;
  skills: string[];
  about: string;
  responsibilities: string[];
  channel: "kaamkaaj" | "external";
  applyUrl: string | null;
  state: "open" | "closed" | "applied" | "draft";
  existingApplicationId: string | null;
}

export interface PlanItem {
  boardId: number;
  title: string;
  company: string;
  url: string;
  channel: JobListing["channel"];
  fit: number;
  matched: string[];
  missing: string[];
  reasons: string[];
}

export interface Rejection {
  boardId: number;
  title: string;
  company: string;
  reason: string;
}

export interface FilledAnswer {
  label: string;
  value: string;
  source: string;
}

export type ApplicationStatus = "queued" | "applying" | "submitting" | "submitted" | "skipped" | "blocked";

export interface ApplicationRecord {
  boardId: number;
  title: string;
  company: string;
  url: string;
  channel: JobListing["channel"];
  status: ApplicationStatus;
  applicationId: string | null;
  submittedAt: string | null;
  loggedToTracker: boolean;
  recovered: boolean;
  answers: FilledAnswer[];
  reason: string | null;
  screenshot: string | null;
}

export type ApprovalKind = "plan" | "limit" | "fee" | "commitment" | "input" | "submit";

export interface ApprovalOption {
  value: string;
  label: string;
}

export interface Approval {
  id: string;
  kind: ApprovalKind;
  title: string;
  detail: string;
  boardId: number | null;
  options: ApprovalOption[];
  allowText: boolean;
  createdAt: string;
  decision: { value: string; text?: string; at: string } | null;
}

export type StepLevel = "info" | "action" | "warn" | "error" | "success";

export interface Step {
  n: number;
  at: string;
  phase: Phase;
  level: StepLevel;
  message: string;
  screenshot: string | null;
}

export type Phase = "understand" | "search" | "shortlist" | "apply" | "verify" | "report" | "done";

export type RunStatus =
  | "running"
  | "paused"
  | "waiting"
  | "completed"
  | "incomplete"
  | "stopped"
  | "failed"
  | "interrupted";

export type CheckResult = "pass" | "fail" | "unknown" | "n/a";

export interface JobVerification {
  boardId: number;
  title: string;
  company: string;
  applicationId: string | null;
  board: CheckResult;
  email: CheckResult;
  tracker: CheckResult;
  duplicates: CheckResult;
  filters: CheckResult;
  verdict: "verified" | "partly verified" | "not verified";
  notes: string[];
}

export interface Verification {
  at: string;
  jobs: JobVerification[];
  target: number;
  verifiedCount: number;
  goalMet: boolean;
  summary: string;
  gaps: string[];
  evidence: { label: string; screenshot: string }[];
}

export interface RunState {
  id: string;
  goal: string;
  profilePath: string;
  profileName: string;
  authority: Authority;
  status: RunStatus;
  phase: Phase;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  llm: { mode: "groq" | "rules"; model: string | null; calls: number; fallbacks: number };
  mission: Mission | null;
  target: number;
  candidates: JobListing[];
  plan: PlanItem[];
  rejected: Rejection[];
  applications: Record<string, ApplicationRecord>;
  approvals: Approval[];
  steps: Step[];
  verification: Verification | null;
  outcome: string | null;
  error: string | null;
  latestScreenshot: string | null;
  resumedCount: number;
}
