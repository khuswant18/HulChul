import fs from "node:fs";
import path from "node:path";
import { existingApplications, jobs as seedJobs, users } from "./seed.ts";

const DATA_DIR = path.resolve(".sandbox-data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const DAY = 24 * 60 * 60 * 1000;

export interface Application {
  applicationId: string;
  jobId: number;
  email: string;
  submittedAt: string;
  status: "Submitted" | "Under review";
  channel: "kaamkaaj" | "zentrail";
  answers: Record<string, string>;
  resumeFile: string;
}

export interface Draft {
  jobId: number;
  email: string;
  fields: Record<string, string>;
  resumeFile?: string;
  updatedAt: string;
}

export interface Mail {
  id: number;
  to: string;
  from: string;
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
}

export interface Faults {
  submitGlitch: boolean;

  submitHang: boolean;

  expireSessionAfter: number;

  closedJobs: number[];

  mailOutage: boolean;

  slowMs: number;
}

interface State {
  seededAt: string;
  applications: Application[];
  drafts: Draft[];
  mails: Mail[];
  sessions: Record<string, { email: string; requestsLeft: number | null }>;
  faults: Faults;
  counters: { kaamkaaj: number; zentrail: number; mail: number };
}

export const noFaults = (): Faults => ({
  submitGlitch: false,
  submitHang: false,
  expireSessionAfter: 0,
  closedJobs: [],
  mailOutage: false,
  slowMs: 0,
});

function freshState(): State {
  const now = Date.now();
  return {
    seededAt: new Date(now).toISOString(),
    applications: existingApplications.map((a) => ({
      applicationId: a.applicationId,
      jobId: a.jobId,
      email: a.email,
      submittedAt: new Date(now - a.daysAgo * DAY).toISOString(),
      status: "Under review",
      channel: "kaamkaaj",
      answers: {},
      resumeFile: "resume.pdf",
    })),
    drafts: [],
    mails: [],
    sessions: {},
    faults: noFaults(),
    counters: { kaamkaaj: 30211, zentrail: 4470, mail: 1 },
  };
}

let state: State = load();

function load(): State {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as State;
  }
  return freshState();
}

export function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

export function reset() {
  state = freshState();
  fs.rmSync(path.join(DATA_DIR, "uploads"), { recursive: true, force: true });
  uploadsDir();
  save();
}

export const uploadsDir = () => {
  const dir = path.join(DATA_DIR, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const db = () => state;

export function listJobs() {
  const seeded = new Date(state.seededAt).getTime();
  return seedJobs.map((job) => ({
    ...job,
    postedOn: new Date(seeded - job.postedDaysAgo * DAY),
    deadline: new Date(seeded + job.deadlineInDays * DAY),
    closed: state.faults.closedJobs.includes(job.id),
  }));
}

export type Job = ReturnType<typeof listJobs>[number];

export function findJob(id: number) {
  return listJobs().find((job) => job.id === id);
}

export function findUser(email: string) {
  return users.find((u) => u.email === email.trim().toLowerCase());
}

export function nextId(kind: "kaamkaaj" | "zentrail") {
  state.counters[kind] += 1;
  return kind === "kaamkaaj" ? `KK-${state.counters.kaamkaaj}` : `ZT-${state.counters.zentrail}`;
}

export function deliverMail(mail: Omit<Mail, "id" | "sentAt" | "read">) {
  state.mails.push({ ...mail, id: state.counters.mail++, sentAt: new Date().toISOString(), read: false });
}
