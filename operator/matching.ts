import { canonicalSkill, type Profile } from "./profile.ts";
import type { TrackerRow } from "./tracker.ts";
import type { JobListing, Mission, PlanItem, Rejection } from "./types.ts";

const DAY = 86_400_000;
const MIN_FIT = 0.34;

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export function daysSince(iso: string, now = Date.now()) {
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

export function alreadyApplied(job: JobListing, tracker: TrackerRow[]) {
  if (job.state === "applied") return job.existingApplicationId ?? "on the board";
  const row = tracker.find(
    (r) =>
      r.jobUrl === job.url ||
      (r.company.toLowerCase() === job.company.toLowerCase() && r.role.toLowerCase() === job.title.toLowerCase()),
  );
  return row ? row.applicationId || "in your tracker" : null;
}

export function constraintProblem(job: JobListing, mission: Mission, now = Date.now()): string | null {
  if (mission.locations.length && !mission.locations.includes(job.location)) {
    return `Location is ${job.location}, goal asks for ${mission.locations.join(" or ")}`;
  }
  if (mission.minStipend && job.stipendMin < mission.minStipend) {
    return `Stipend starts at ${inr(job.stipendMin)}, below ${inr(mission.minStipend)}`;
  }
  const age = daysSince(job.postedOn, now);
  if (mission.postedWithinDays && age > mission.postedWithinDays) {
    return `Posted ${age} days ago, goal asks for the last ${mission.postedWithinDays}`;
  }
  if (mission.excludeCompanies.some((c) => c.toLowerCase() === job.company.toLowerCase())) {
    return `${job.company} is excluded in the goal`;
  }
  if (new Date(job.deadline).getTime() < now) return "Application deadline has passed";
  return null;
}

export function shortlist(jobs: JobListing[], mission: Mission, profile: Profile, tracker: TrackerRow[], now = Date.now()) {
  const ranked: PlanItem[] = [];
  const rejected: Rejection[] = [];
  const mine = new Set(profile.skills.map(canonicalSkill));

  for (const job of jobs) {
    const reject = (reason: string) => rejected.push({ boardId: job.boardId, title: job.title, company: job.company, reason });

    if (job.state === "closed") {
      reject("Posting is closed");
      continue;
    }
    const applied = alreadyApplied(job, tracker);
    if (applied) {
      reject(`Already applied (${applied})`);
      continue;
    }
    const problem = constraintProblem(job, mission, now);
    if (problem) {
      reject(problem);
      continue;
    }

    const matched = job.skills.filter((s) => mine.has(canonicalSkill(s)));
    const missing = job.skills.filter((s) => !mine.has(canonicalSkill(s)));
    const fit = job.skills.length ? matched.length / job.skills.length : 0;
    if (fit < MIN_FIT) {
      reject(`Weak skill match: you have ${matched.length} of ${job.skills.length} (${job.skills.join(", ")})`);
      continue;
    }

    const age = daysSince(job.postedOn, now);
    const reasons = [
      matched.length ? `Matches ${matched.join(", ")}` : "No listed skills matched",
      `${inr(job.stipendMax)}/month`,
      `Posted ${age === 0 ? "today" : `${age}d ago`}`,
    ];
    if (job.channel === "external") reasons.push("Applies on company site");

    ranked.push({
      boardId: job.boardId,
      title: job.title,
      company: job.company,
      url: job.url,
      channel: job.channel,
      fit: Math.round(fit * 100),
      matched,
      missing,
      reasons,
    });
  }

  const byId = new Map(jobs.map((j) => [j.boardId, j]));
  ranked.sort((a, b) => {
    if (b.fit !== a.fit) return b.fit - a.fit;
    const ja = byId.get(a.boardId)!;
    const jb = byId.get(b.boardId)!;
    if (jb.stipendMax !== ja.stipendMax) return jb.stipendMax - ja.stipendMax;
    return new Date(jb.postedOn).getTime() - new Date(ja.postedOn).getTime();
  });

  return { ranked, rejected };
}
