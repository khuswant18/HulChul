import type { RunContext } from "./context.ts";
import { constraintProblem } from "./matching.ts";
import { Kaamkaaj, type BoardApplication } from "./sites/kaamkaaj.ts";
import { MailboxUnavailable, Postbox, type InboxMail } from "./sites/postbox.ts";
import { readTracker } from "./tracker.ts";
import type { CheckResult, JobVerification, Verification } from "./types.ts";

// Verification starts from nothing: a new browser session, the live board,
// the live inbox and the tracker file on disk. It does not trust the run's
// own memory of what happened, only what those three sources show now.

export async function verifyRun(ctx: RunContext): Promise<Verification> {
  const { context, page } = await ctx.browser.newPage();
  // Read-only work, so it ignores pause/stop and runs even after a stop.
  const driver = { page, checkpoint: async () => {}, log: ctx.driver.log };
  const evidence: Verification["evidence"] = [];
  const log = (level: Parameters<RunContext["log"]>[0], message: string, shot?: string) => ctx.log(level, message, shot, page);

  try {
    const board = new Kaamkaaj(driver, ctx.urls.kaamkaaj, ctx.credentials);
    await board.login();
    const boardRows: BoardApplication[] = await board.myApplications();
    const boardShot = await log("info", `Verification: Kaamkaaj lists ${boardRows.length} application(s)`, "verify my applications");
    if (boardShot) evidence.push({ label: "Kaamkaaj › My applications", screenshot: boardShot });

    let inbox: InboxMail[] | null = null;
    const mailBodies = new Map<number, string>();
    const postbox = new Postbox(driver, ctx.urls.postbox, ctx.credentials);
    for (let attempt = 1; attempt <= 3 && inbox === null; attempt++) {
      try {
        inbox = await postbox.inbox();
        const shot = await log("info", `Verification: Postbox inbox has ${inbox.length} message(s)`, "verify inbox");
        if (shot) evidence.push({ label: "Postbox inbox", screenshot: shot });
        for (const m of inbox) mailBodies.set(m.id, await postbox.read(m.id));
      } catch (error) {
        if (!(error instanceof MailboxUnavailable)) throw error;
        await log("warn", `Verification: ${error.message} (attempt ${attempt} of 3)`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }

    const trackerRows = await readTracker(ctx.profile.trackerPath);
    await log("info", `Verification: tracker has ${trackerRows.length} row(s)`);

    const jobs: JobVerification[] = [];
    const gaps: string[] = [];

    for (const rec of Object.values(ctx.state.applications)) {
      if (rec.status !== "submitted") {
        if (rec.status === "submitting") gaps.push(`${rec.company} · ${rec.title}: outcome unknown. ${rec.reason ?? "The run stopped while submitting."}`);
        else if (rec.status !== "queued") gaps.push(`${rec.company} · ${rec.title}: ${rec.status}. ${rec.reason ?? ""}`.trim());
        continue;
      }
      const id = rec.applicationId!;
      const notes: string[] = [];

      let boardCheck: CheckResult = "n/a";
      let duplicates: CheckResult = "pass";
      if (rec.channel === "kaamkaaj") {
        const rows = boardRows.filter((r) => r.boardId === rec.boardId);
        boardCheck = rows.some((r) => r.applicationId === id) ? "pass" : "fail";
        if (rows.length > 1) {
          duplicates = "fail";
          notes.push(`Board shows ${rows.length} applications for this job`);
        }
        if (boardCheck === "fail") notes.push(`${id} is not on My applications`);
      } else {
        notes.push("External site: no applications page, relying on the email");
      }

      let email: CheckResult = "unknown";
      if (inbox) {
        const mentions = inbox.filter((m) => (m.subject + " " + (mailBodies.get(m.id) ?? "")).includes(id));
        email = mentions.length ? "pass" : "fail";
        if (email === "fail") notes.push(`No confirmation email mentions ${id}`);
        if (rec.channel === "external") {
          const sameJob = inbox.filter((m) => (mailBodies.get(m.id) ?? "").includes(rec.title) && m.from.toLowerCase().includes(rec.company.toLowerCase().split(" ")[0]));
          if (sameJob.length > 1) {
            duplicates = "fail";
            notes.push(`${sameJob.length} confirmation emails for this job: a duplicate was sent`);
          }
        }
      } else {
        notes.push("Postbox unavailable, email not checked");
      }

      const trackerMatches = trackerRows.filter((r) => r.applicationId === id);
      const tracker: CheckResult = trackerMatches.length === 1 ? "pass" : "fail";
      if (trackerMatches.length === 0) notes.push("Missing from the tracker");
      if (trackerMatches.length > 1) notes.push("Tracker has duplicate rows");

      const listing = ctx.state.candidates.find((c) => c.boardId === rec.boardId);
      const problem = listing && ctx.state.mission ? constraintProblem(listing, ctx.state.mission, new Date(ctx.state.createdAt).getTime()) : null;
      const filters: CheckResult = listing ? (problem ? "fail" : "pass") : "unknown";
      if (problem) notes.push(`Does not meet the goal: ${problem}`);

      const results = [boardCheck, email, tracker, duplicates, filters];
      const verdict = results.includes("fail") ? "not verified" : results.includes("unknown") ? "partly verified" : "verified";
      jobs.push({ boardId: rec.boardId, title: rec.title, company: rec.company, applicationId: id, board: boardCheck, email, tracker, duplicates, filters, verdict, notes });
    }

    const verifiedCount = jobs.filter((j) => j.verdict === "verified").length;
    const target = ctx.state.target;
    const goalMet = verifiedCount >= target;

    const unproven = jobs.filter((j) => j.verdict !== "verified");
    for (const j of unproven) gaps.push(`${j.company} · ${j.title} (${j.applicationId}): ${j.verdict}. ${j.notes.join("; ")}`);
    if (jobs.length < target) {
      const left = ctx.state.plan.filter((p) => !ctx.state.applications[String(p.boardId)]).length;
      gaps.push(
        left
          ? `Only ${jobs.length} of ${target} applications were made before the run ended.`
          : `Only ${jobs.length} of ${target} applications: no more jobs matched the goal.`,
      );
    }

    const summary = goalMet
      ? `Goal met: ${verifiedCount} of ${target} applications verified on the board, in the inbox and in the tracker.`
      : `Goal not fully met: ${verifiedCount} of ${target} applications verified.`;
    await log(goalMet ? "success" : "warn", summary);

    return { at: new Date().toISOString(), jobs, target, verifiedCount, goalMet, summary, gaps, evidence };
  } finally {
    await context.close().catch(() => null);
  }
}
