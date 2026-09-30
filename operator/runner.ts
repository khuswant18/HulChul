import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { applyToJob, logToTracker } from "./apply.ts";
import { browserOptionsFromEnv, OperatorBrowser, type BrowserOptions } from "./browser.ts";
import { sandboxUrlsFromEnv, type RunContext } from "./context.ts";
import { RunControl, StopRequested } from "./control.ts";
import { parseGoal } from "./goal.ts";
import { Journal } from "./journal.ts";
import { Llm } from "./llm.ts";
import { shortlist } from "./matching.ts";
import { loadProfile, type Profile } from "./profile.ts";
import { writeReport } from "./report.ts";
import { Kaamkaaj } from "./sites/kaamkaaj.ts";
import { readTracker } from "./tracker.ts";
import type { Authority, JobListing, Phase, RunState, StepLevel } from "./types.ts";
import { verifyRun } from "./verify.ts";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export function newRunState(goal: string, profilePath: string, profileName: string, authority: Authority): RunState {
  const now = new Date();
  const id = `${now.toISOString().slice(0, 16).replace(/[-:T]/g, "")}-${crypto.randomBytes(2).toString("hex")}`;
  return {
    id,
    goal,
    profilePath,
    profileName,
    authority,
    status: "running",
    phase: "understand",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    finishedAt: null,
    llm: { mode: "rules", model: null, calls: 0, fallbacks: 0 },
    mission: null,
    target: 0,
    candidates: [],
    plan: [],
    rejected: [],
    applications: {},
    approvals: [],
    steps: [],
    verification: null,
    outcome: null,
    error: null,
    latestScreenshot: null,
    resumedCount: 0,
  };
}

export class Run {
  readonly journal: Journal;
  readonly control: RunControl;
  private llm: Llm;
  private phase: Phase = "understand";
  private finished: Promise<RunState> | null = null;

  constructor(
    state: RunState,
    private browserOptions: BrowserOptions = browserOptionsFromEnv(),
  ) {
    this.journal = new Journal(state);
    this.llm = new Llm((message) => this.journal.step(this.phase, "warn", message));
    this.control = new RunControl({
      onPauseChange: (paused) => {
        this.journal.update((s) => (s.status = paused ? "paused" : "running"));
        this.journal.step(this.phase, "info", paused ? "Paused by you. Will stop before the next action." : "Resumed.");
      },
      onApproval: (approval) => {
        this.journal.update((s) => {
          s.approvals.push(approval);
          s.status = "waiting";
        });
      },
      onDecision: (approval) => {
        this.journal.update((s) => {
          const stored = s.approvals.find((a) => a.id === approval.id);
          if (stored) stored.decision = approval.decision;
          s.status = this.control.isPaused ? "paused" : "running";
        });
        const chosen = approval.options.find((o) => o.value === approval.decision?.value)?.label ?? approval.decision?.value;
        this.journal.step(this.phase, "info", `You decided: ${chosen}${approval.decision?.text ? ` (“${approval.decision.text}”)` : ""}`);
      },
    });
  }

  static start(goal: string, profilePath: string, authority: Authority, browserOptions?: BrowserOptions) {
    const profile = loadProfile(profilePath);
    const run = new Run(newRunState(goal.trim(), profilePath, profile.name, authority), browserOptions);
    run.finished = run.execute();
    return run;
  }

  static resume(id: string, browserOptions?: BrowserOptions) {
    const state = Journal.load(id);
    if (!state) throw new Error(`No run called ${id}`);
    if (state.status === "completed") throw new Error(`Run ${id} already met its goal`);

    for (const a of state.approvals) if (!a.decision) a.decision = { value: "expired", at: new Date().toISOString() };
    Object.assign(state, { status: "running", error: null, outcome: null, finishedAt: null, resumedCount: state.resumedCount + 1 });
    const run = new Run(state, browserOptions);
    run.finished = run.execute();
    return run;
  }

  get state() {
    return this.journal.state;
  }

  done() {
    return this.finished!;
  }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.journal.update((s) => (s.phase = phase));
  }

  private async execute(): Promise<RunState> {
    const browser = new OperatorBrowser(this.journal.shotsDir, this.browserOptions);
    browser.startCounterAt(fs.existsSync(this.journal.shotsDir) ? fs.readdirSync(this.journal.shotsDir).length : 0);
    let ctx: RunContext | null = null;

    try {
      if (this.state.resumedCount > 0) {
        this.journal.step(this.phase, "warn", `Resuming run (restart #${this.state.resumedCount}). Picking up from the journal.`);
      }
      const profile = loadProfile(this.state.profilePath);
      this.journal.update((s) => (s.llm = { mode: this.llm.mode, model: this.llm.enabled ? this.llm.model : null, calls: s.llm.calls, fallbacks: s.llm.fallbacks }));

      await browser.launch();
      const { page } = await browser.newPage();
      ctx = this.buildContext(browser, page, profile);

      await this.understand(ctx);
      await this.discover(ctx);
      await this.approvePlan(ctx);
      await this.applyAll(ctx);
      await this.finish(ctx, "done");
    } catch (error) {
      if (error instanceof StopRequested) {
        this.journal.step(this.phase, "warn", "Stopped by you. Nothing else will be submitted. Checking what was done so far.");
        await this.finish(ctx, "stopped");
      } else {
        const message = (error as Error).message.split("\n")[0];
        this.journal.step(this.phase, "error", `Run failed: ${message}`);
        this.journal.update((s) => (s.error = message));
        await this.finish(ctx, "failed");
      }
    } finally {
      await browser.close();
      this.syncLlmStats();
    }
    return this.state;
  }

  private buildContext(browser: OperatorBrowser, page: Page, profile: Profile): RunContext {
    const journal = this.journal;
    const log = async (level: StepLevel, message: string, screenshotLabel?: string, onPage: Page = page) => {
      const shot = screenshotLabel ? await browser.screenshot(onPage, screenshotLabel) : null;
      journal.step(this.phase, level, message, shot);
      this.syncLlmStats();
      return shot;
    };
    const driver = { page, checkpoint: () => this.control.checkpoint(), log };
    const credentials = { email: profile.email, password: process.env.SANDBOX_PASSWORD ?? "demo-pass-2026" };
    const urls = sandboxUrlsFromEnv();
    const remembered = new Map<string, string>();

    return {
      journal,
      control: this.control,
      browser,
      page,
      driver,
      board: new Kaamkaaj(driver, urls.kaamkaaj, credentials),
      profile,
      llm: this.llm,
      urls,
      credentials,
      remembered,
      get state() {
        return journal.state;
      },
      log,
    };
  }

  private syncLlmStats() {
    this.journal.update((s) => {
      s.llm.calls = this.llm.calls;
      s.llm.fallbacks = this.llm.fallbacks;
    });
  }

  private async understand(ctx: RunContext) {
    this.setPhase("understand");
    if (!this.state.mission) {
      await ctx.log("info", `Goal: “${this.state.goal}”`);
      const { mission, via } = await parseGoal(this.state.goal, ctx.profile, this.llm);
      this.journal.update((s) => (s.mission = mission));
      await ctx.log("info", `Understood (${via === "groq" ? "Groq" : "rules"}): ${mission.summary}`);
      for (const note of mission.assumptions) await ctx.log("warn", `Assumption: ${note}`);

      const tracker = await readTracker(ctx.profile.trackerPath);
      await ctx.log("info", `Read ${ctx.profile.name}'s profile and tracker (${tracker.length} earlier application${tracker.length === 1 ? "" : "s"}).`);
    }

    if (!this.state.target) {
      const { mission, authority } = this.state;
      let target = Math.min(mission!.maxApplications, authority.maxApplications);
      if (mission!.maxApplications > authority.maxApplications) {
        const decision = await this.control.ask({
          kind: "limit",
          title: `The goal asks for ${mission!.maxApplications} applications, you allowed ${authority.maxApplications}`,
          detail: "The operator stays within the limit you set unless you raise it for this run.",
          options: [
            { value: "keep", label: `Stay at ${authority.maxApplications}` },
            { value: "raise", label: `Allow ${mission!.maxApplications} for this run` },
          ],
        });
        if (decision.value === "raise") target = mission!.maxApplications;
      }
      this.journal.update((s) => (s.target = target));
    }
  }

  private async discover(ctx: RunContext) {
    if (this.state.plan.length || this.state.rejected.length) return;
    this.setPhase("search");
    const mission = this.state.mission!;
    await ctx.board.open("/jobs");
    await ctx.board.recoverSession();

    const urls = new Set<string>();
    for (const q of mission.keywords) {
      const found = await ctx.board.search({
        q,
        location: mission.locations.length === 1 ? mission.locations[0] : "",
        minStipend: mission.minStipend,
        postedWithinDays: mission.postedWithinDays,
      });
      found.forEach((u) => urls.add(u));
    }
    await ctx.log("info", `Found ${urls.size} posting${urls.size === 1 ? "" : "s"} across ${mission.keywords.length} search${mission.keywords.length === 1 ? "" : "es"}. Reading each one.`);

    const candidates: JobListing[] = [];
    for (const url of urls) {
      const job = await ctx.board.readJob(url);
      candidates.push(job);
      await ctx.log("action", `Read ${job.company} · ${job.title}: ${job.location}, ${inr(job.stipendMax)}/month, ${job.skills.join(", ")}`);
    }
    this.journal.update((s) => (s.candidates = candidates));

    this.setPhase("shortlist");
    const tracker = await readTracker(ctx.profile.trackerPath);
    const { ranked, rejected } = shortlist(candidates, mission, ctx.profile, tracker);
    this.journal.update((s) => {
      s.plan = ranked;
      s.rejected = rejected;
    });
    for (const r of rejected) await ctx.log("info", `Left out ${r.company} · ${r.title}: ${r.reason}`);
    await ctx.log(
      ranked.length ? "info" : "warn",
      ranked.length
        ? `Shortlist: ${ranked.map((p, i) => `${i + 1}. ${p.company} (${p.fit}% fit)`).join(", ")}. Aiming for ${this.state.target}; the rest are backups.`
        : "No posting matched every part of the goal.",
    );
  }

  private async approvePlan(ctx: RunContext) {
    if (!this.state.authority.confirmPlan || !this.state.plan.length) return;
    if (this.state.approvals.some((a) => a.kind === "plan" && a.decision?.value === "approve")) return;

    const lines = this.state.plan.map(
      (p, i) => `${i < this.state.target ? "Apply" : "Backup"} ${i + 1}. ${p.company} · ${p.title} (${p.fit}% fit): ${p.reasons.join(", ")}`,
    );
    const decision = await this.control.ask({
      kind: "plan",
      title: `Apply to ${Math.min(this.state.target, this.state.plan.length)} of these ${this.state.plan.length} jobs?`,
      detail: lines.join("\n") + "\n\nBackups are used only if one of the first choices is skipped or blocked.",
      options: [
        { value: "approve", label: "Approve plan" },
        { value: "cancel", label: "Cancel run" },
      ],
    });
    if (decision.value !== "approve") {
      await ctx.log("warn", "You cancelled the plan. Nothing was submitted.");
      throw new StopRequested();
    }
  }

  private async applyAll(ctx: RunContext) {
    this.setPhase("apply");
    const submitted = () => Object.values(this.state.applications).filter((a) => a.status === "submitted").length;

    for (const item of this.state.plan) {
      if (submitted() >= this.state.target) break;
      const key = String(item.boardId);
      const existing = this.state.applications[key];
      if (existing && ["submitted", "skipped", "blocked"].includes(existing.status)) continue;

      if (!existing) {
        this.journal.update((s) => {
          s.applications[key] = {
            boardId: item.boardId,
            title: item.title,
            company: item.company,
            url: item.url,
            channel: item.channel,
            status: "queued",
            applicationId: null,
            submittedAt: null,
            loggedToTracker: false,
            recovered: false,
            answers: [],
            reason: null,
            screenshot: null,
          };
        });
      }

      const job = this.state.candidates.find((c) => c.boardId === item.boardId)!;
      try {
        await applyToJob(ctx, job);
      } catch (error) {
        if (error instanceof StopRequested) throw error;
        const message = (error as Error).message.split("\n")[0];
        const shot = await ctx.log("error", `${item.company}: unexpected error, moving on. ${message}`, `error ${item.company}`);

        if (this.state.applications[key].status !== "submitting") {
          this.journal.update((s) => Object.assign(s.applications[key], { status: "blocked", reason: message, screenshot: shot }));
        }
      }
    }

    for (const rec of Object.values(this.state.applications)) {
      if (rec.status === "submitted" && !rec.loggedToTracker) await logToTracker(ctx, rec);
    }
  }

  private async finish(ctx: RunContext | null, how: "done" | "stopped" | "failed") {
    if (ctx && this.state.mission) {
      this.setPhase("verify");
      try {
        const verification = await verifyRun(ctx);
        this.journal.update((s) => (s.verification = verification));
      } catch (error) {
        this.journal.step("verify", "error", `Verification could not finish: ${(error as Error).message.split("\n")[0]}`);
      }
    }

    this.setPhase("report");
    const v = this.state.verification;
    const status = how === "done" ? (v?.goalMet ? "completed" : "incomplete") : how;
    const outcome =
      how === "failed"
        ? `Failed: ${this.state.error}`
        : v
          ? `${how === "stopped" ? "Stopped early. " : ""}${v.summary}`
          : how === "stopped"
            ? "Stopped before anything was submitted."
            : "Finished without verification.";

    this.journal.update((s) => {
      s.status = status;
      s.outcome = outcome;
      s.finishedAt = new Date().toISOString();
    });
    const reportPath = writeReport(this.state, this.journal.dir);
    this.phase = "done";
    this.journal.update((s) => (s.phase = "done"));
    this.journal.step("done", "info", `Report written to ${path.relative(process.cwd(), reportPath)}`);
  }
}
