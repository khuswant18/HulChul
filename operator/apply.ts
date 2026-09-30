import type { Page } from "playwright";
import { planAnswers, type FieldPlan } from "./answers.ts";
import { clickSubmit, fillField, highlightField, isFinalStep, pageErrors, readForm } from "./forms.ts";
import type { RunContext } from "./context.ts";
import { Kaamkaaj } from "./sites/kaamkaaj.ts";
import { MailboxUnavailable, Postbox } from "./sites/postbox.ts";
import { visibleText } from "./sites/driver.ts";
import { upsertTrackerRow } from "./tracker.ts";
import type { ApplicationRecord, JobListing } from "./types.ts";

const MAX_FORM_STEPS = 6;

type Found = { applicationId: string; how: string } | null;

export async function findExistingApplication(ctx: RunContext, job: JobListing): Promise<Found | "unknown"> {
  const tab = await ctx.page.context().newPage();
  const driver = { ...ctx.driver, page: tab };
  try {
    if (job.channel === "kaamkaaj") {
      const board = new Kaamkaaj(driver, ctx.urls.kaamkaaj, ctx.credentials);
      const rows = await board.myApplications();
      await ctx.log("action", "Checked My applications on Kaamkaaj", "reconcile my applications", tab);
      const row = rows.find((r) => r.boardId === job.boardId);
      return row ? { applicationId: row.applicationId, how: "found on Kaamkaaj › My applications" } : null;
    }

    const mail = new Postbox(driver, ctx.urls.postbox, ctx.credentials);
    const known = new Set(Object.values(ctx.state.applications).map((a) => a.applicationId).filter(Boolean));
    const inbox = await mail.inbox();
    await ctx.log("action", "Checked Postbox for a confirmation email", "reconcile inbox", tab);
    const companyWord = job.company.toLowerCase().split(" ")[0];
    for (const message of inbox.filter((m) => m.from.toLowerCase().includes(companyWord))) {
      const body = await mail.read(message.id);
      const ref = (message.subject + " " + body).match(/\b[A-Z]{2}-\d{3,}\b/)?.[0];
      if (ref && !known.has(ref) && body.includes(job.title)) {
        return { applicationId: ref, how: `confirmation email from ${message.from}` };
      }
    }
    return null;
  } catch (error) {
    if (error instanceof MailboxUnavailable) {
      await ctx.log("warn", `${error.message}. Can't check for a confirmation email right now.`);
      return "unknown";
    }
    throw error;
  } finally {
    await tab.close().catch(() => null);
  }
}

function readConfirmation(text: string) {
  const match = text.match(/(?:application id|reference)\W+(?:is\W+)?([A-Z]{2}-\d{3,})/i);
  const looksDone = /submitted|received|thanks|thank you/i.test(text);
  return match && looksDone ? match[1] : null;
}

const looksClosed = (text: string) => /no longer accepting|role is closed|posting (is )?closed/i.test(text);

async function askAboutField(ctx: RunContext, job: JobListing, plan: Extract<FieldPlan, { action: "ask" }>) {
  const { field } = plan;
  const where = `${job.company} · ${job.title}`;
  const skip = { value: "skip", label: "Skip this job" };

  if (plan.kind === "fee" || plan.kind === "commitment") {
    const decision = await ctx.control.ask({
      kind: plan.kind,
      boardId: job.boardId,
      title: plan.kind === "fee" ? `${job.company} wants you to agree to a fee` : `${job.company} wants you to accept a contract term`,
      detail: `${where}\n\nThe form says: “${field.label}”\n\n${plan.reason}`,
      options: [skip, { value: "agree", label: "I agree, tick it and continue" }],
    });
    return decision.value === "agree" ? "yes" : null;
  }

  const options = field.options.length
    ? field.options.map((o) => ({ value: `option:${o}`, label: o }))
    : [{ value: "text", label: "Use my answer" }];
  const decision = await ctx.control.ask({
    kind: "input",
    boardId: job.boardId,
    title: `${job.company} asks something your profile doesn't answer`,
    detail: `${where}\n\n“${field.label}”\n\n${plan.reason}`,
    options: [...options, skip],
    allowText: !field.options.length,
  });
  if (decision.value === "skip") return null;
  if (decision.value.startsWith("option:")) return decision.value.slice("option:".length);
  return decision.text?.trim() || null;
}

function answerSummary(plans: FieldPlan[]) {
  return plans
    .filter((p): p is Extract<FieldPlan, { action: "fill" }> => p.action === "fill")
    .map((p) => {
      const value = p.field.kind === "file" ? p.value.split("/").pop()! : p.value;
      return { label: p.field.label, value: value.length > 160 ? value.slice(0, 157) + "…" : value, source: p.source };
    });
}

export async function applyToJob(ctx: RunContext, job: JobListing) {
  const key = String(job.boardId);
  const record = () => ctx.state.applications[key];
  const set = (patch: Partial<ApplicationRecord>) => ctx.journal.update((s) => Object.assign(s.applications[key], patch));
  const where = `${job.company} · ${job.title}`;

  const succeed = async (applicationId: string, recovered: boolean, how: string, page: Page) => {
    const blank = page.url() === "about:blank";
    const shot = (await ctx.log("success", `${where}: application ${applicationId} (${how})`, blank ? undefined : `submitted ${job.company}`, page)) ?? ctx.state.latestScreenshot;
    set({ status: "submitted", applicationId, submittedAt: record().submittedAt ?? new Date().toISOString(), recovered, screenshot: shot, reason: null });
    await logToTracker(ctx, job);
  };
  const stopWith = async (status: "skipped" | "blocked", reason: string) => {
    const shot = await ctx.log(status === "skipped" ? "warn" : "error", `${where}: ${status}. ${reason}`, `${status} ${job.company}`);
    set({ status, reason, screenshot: shot });
  };

  const leaveUnresolved = async (reason: string) => {
    const shot = await ctx.log("error", `${where}: outcome unknown. ${reason}`, `unresolved ${job.company}`);
    set({ status: "submitting", reason, screenshot: shot });
  };

  if (record().status === "submitting") {
    await ctx.log("warn", `${where}: the last run stopped in the middle of submitting. Checking whether it went through.`);
    const found = await findExistingApplication(ctx, job);
    if (found === "unknown") return leaveUnresolved("Can't tell whether the interrupted submit went through, and won't risk a duplicate. Resume the run once the inbox is reachable.");
    if (found) return succeed(found.applicationId, true, found.how, ctx.page);
    await ctx.log("info", `${where}: no trace of the earlier submit, so it is safe to apply.`);
  }

  set({ status: "applying", reason: null });

  const fresh = await ctx.board.readJob(job.url);
  if (fresh.state === "applied" && fresh.existingApplicationId) {
    return succeed(fresh.existingApplicationId, true, "the board already shows this application", ctx.page);
  }
  if (fresh.state === "closed") return stopWith("blocked", "The posting closed after the plan was made.");

  if (fresh.channel === "external" && fresh.applyUrl) {
    await ctx.log("action", `${where}: opening the company's careers site`);
    await ctx.driver.checkpoint();
    await ctx.page.goto(fresh.applyUrl, { waitUntil: "domcontentloaded" });
  } else {
    const button = ctx.page.getByRole("link", { name: /apply now|continue application/i });
    const label = (await button.innerText()).trim();
    await ctx.log("action", `${where}: ${label === "Continue application" ? "continuing a saved draft" : "starting the application"}`);
    await ctx.driver.checkpoint();
    await Promise.all([ctx.page.waitForLoadState("domcontentloaded"), button.click()]);
    await ctx.board.recoverSession();
  }

  let ambiguousRetries = 0;
  let serverErrors = 0;
  let lastWasFinalSubmit = false;

  for (let step = 1; step <= MAX_FORM_STEPS; step++) {
    await ctx.driver.checkpoint();
    const text = await visibleText(ctx.page);

    const confirmation = readConfirmation(text);
    if (confirmation) return succeed(confirmation, false, "confirmation page", ctx.page);
    if (looksClosed(text)) return stopWith("blocked", "The site says the posting is no longer open.");

    if (lastWasFinalSubmit) {
      const found = await findExistingApplication(ctx, job);
      if (found === "unknown") {
        return leaveUnresolved("The submit result was unclear and the confirmation email can't be checked right now. Not retrying, to avoid a duplicate application. Resume the run once the inbox is reachable.");
      }
      if (found) return succeed(found.applicationId, true, found.how, ctx.page);
      if (ambiguousRetries >= 1) return stopWith("blocked", "The site failed twice on submit and no application exists. Stopping here so it can be retried later.");
      ambiguousRetries += 1;
      await ctx.log("info", `${where}: confirmed nothing was submitted. Trying once more.`);
      lastWasFinalSubmit = false;
      if (!(await readForm(ctx.page))) {
        await ctx.driver.checkpoint();
        await ctx.page.goto(fresh.channel === "external" && fresh.applyUrl ? fresh.applyUrl : `${job.url}/apply`, { waitUntil: "domcontentloaded" });
        await ctx.board.recoverSession();
      }
      continue;
    }

    const form = await readForm(ctx.page);
    if (!form || !form.fields.length) {
      return stopWith("blocked", `Expected an application form at ${ctx.page.url()} but found none.`);
    }

    const plans = await planAnswers(form.fields, {
      profile: ctx.profile,
      job: fresh,
      authority: ctx.state.authority,
      llm: ctx.llm,
      remembered: ctx.remembered,
    });

    for (const [i, plan] of plans.entries()) {
      if (plan.action !== "ask") continue;
      await highlightField(ctx.page, plan.field.name);
      await ctx.log("warn", `${where}: needs you. “${plan.field.label}”`, `needs approval ${job.company}`);
      const value = await askAboutField(ctx, fresh, plan);
      if (value === null) {
        return stopWith("skipped", `You chose to skip it when the form asked: “${plan.field.label}”`);
      }
      ctx.remembered.set(plan.field.label.toLowerCase(), value);
      plans[i] = { field: plan.field, action: "fill", value, source: "your answer" };
    }

    for (const plan of plans) {
      if (plan.action !== "fill") continue;
      await ctx.driver.checkpoint();
      await fillField(ctx.page, plan);
    }
    const answers = answerSummary(plans);
    set({ answers: [...record().answers.filter((a) => !answers.some((b) => b.label === a.label)), ...answers] });

    const final = isFinalStep(form.submitLabel);
    const stepName = final ? "the final step" : `step ${step}`;
    await ctx.log("action", `${where}: filled ${answers.length} field${answers.length === 1 ? "" : "s"} on ${stepName}`, `filled ${job.company} ${final ? "final" : `step ${step}`}`);

    if (final && ctx.state.authority.confirmEachSubmit) {
      const decision = await ctx.control.ask({
        kind: "submit",
        boardId: job.boardId,
        title: `Submit the application to ${job.company}?`,
        detail: answers.map((a) => `${a.label}: ${a.value}`).join("\n"),
        options: [
          { value: "submit", label: "Submit" },
          { value: "skip", label: "Skip this job" },
        ],
      });
      if (decision.value !== "submit") return stopWith("skipped", "You chose not to submit it.");
    }

    if (final) set({ status: "submitting", submittedAt: new Date().toISOString() });

    await ctx.driver.checkpoint();
    const response = await clickSubmit(ctx.page);

    if (!response) {
      await ctx.page.goto("about:blank").catch(() => null);
      await ctx.log("warn", `${where}: no response from the site after 12 seconds. It may or may not have saved it.`);
      lastWasFinalSubmit = final;
      if (!final) return stopWith("blocked", `The site stopped responding while saving step ${step}.`);
      continue;
    }
    const status = response.status();

    if (ctx.board.isLoginPage()) {
      await ctx.log("warn", `${where}: the session expired while sending ${final ? "the final step" : `step ${step}`}. The site dropped it.`, `session lost ${job.company}`);
      await ctx.board.recoverSession();
      lastWasFinalSubmit = final;
      continue;
    }

    if (status >= 500) {
      await ctx.log("warn", `${where}: the site answered HTTP ${status} to the ${final ? "final submit" : `step ${step} submit`}. It may or may not have saved it.`, `http ${status} ${job.company}`);
      lastWasFinalSubmit = final;
      if (!final) {
        serverErrors += 1;
        if (serverErrors >= 2) return stopWith("blocked", `The site keeps failing (HTTP ${status}) when saving step ${step}. Nothing was submitted.`);
        await ctx.page.goBack({ waitUntil: "domcontentloaded" }).catch(() => null);
      }
      continue;
    }

    const errors = await pageErrors(ctx.page);
    if (status === 422 || (errors.length && !readConfirmation(await visibleText(ctx.page)))) {
      return stopWith("blocked", `The form rejected the answers: ${errors.join(" ") || `HTTP ${status}`}`);
    }

    lastWasFinalSubmit = final;
  }

  return stopWith("blocked", `The form still wasn't finished after ${MAX_FORM_STEPS} steps.`);
}

export async function logToTracker(ctx: RunContext, job: Pick<JobListing, "boardId">) {
  const rec = ctx.state.applications[String(job.boardId)];
  if (!rec || rec.status !== "submitted" || !rec.applicationId || rec.loggedToTracker) return;
  const listing = ctx.state.candidates.find((c) => c.boardId === job.boardId);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await upsertTrackerRow(ctx.profile.trackerPath, {
        appliedOn: (rec.submittedAt ?? new Date().toISOString()).slice(0, 10),
        company: rec.company,
        role: rec.title,
        location: listing?.location ?? "",
        stipend: listing?.stipendMax ?? 0,
        source: rec.channel === "external" ? `${rec.company} careers` : "Kaamkaaj",
        jobUrl: rec.url,
        applicationId: rec.applicationId,
        status: "Applied",
        notes: rec.recovered ? "Recovered after an unclear submit" : "",
        runId: ctx.state.id,
      });
      ctx.journal.update((s) => (s.applications[String(job.boardId)].loggedToTracker = true));
      await ctx.log("action", `Tracker: ${result} row for ${rec.company} (${rec.applicationId}) in ${ctx.profile.trackerPath}`);
      return;
    } catch (error) {
      await ctx.log("warn", `Tracker write failed (attempt ${attempt}/3): ${(error as Error).message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}
