import crypto from "node:crypto";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import { db, deliverMail, findJob, findUser, listJobs, nextId, save, uploadsDir, type Job } from "../store.ts";
import { rupees, shortDate } from "../html.ts";
import * as views from "./views.ts";

const PAGE_SIZE = 8;
const COOKIE = "kk_session";

type SignedIn = Request & { user: { email: string; name: string } };

const normalise = (text: string) => text.toLowerCase().replace(/[-_/]+/g, " ");

function matchesKeywords(job: Job, q: string) {
  const haystack = normalise([job.title, job.company, ...job.skills].join(" "));
  return normalise(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function createKaamkaajApp(options: { password: string; zentrailUrl: string }) {
  const app = express();
  const upload = multer({ dest: uploadsDir(), limits: { fileSize: 5 * 1024 * 1024 } });

  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use(async (_req, _res, next) => {
    const { slowMs } = db().faults;
    if (slowMs > 0) await new Promise((r) => setTimeout(r, slowMs));
    next();
  });

  function requireLogin(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies[COOKIE];
    const session = token ? db().sessions[token] : undefined;
    const loginUrl = (expired = false) =>
      `/login?next=${encodeURIComponent(req.originalUrl)}${expired ? "&expired=1" : ""}`;

    if (!session) return res.redirect(loginUrl());

    if (session.requestsLeft !== null) {
      session.requestsLeft -= 1;
      if (session.requestsLeft < 0) {
        delete db().sessions[token];
        save();
        res.clearCookie(COOKIE);
        // Like most real sites, a POST that arrives after expiry is simply lost.
        return res.redirect(loginUrl(true));
      }
      save();
    }
    const user = findUser(session.email)!;
    (req as SignedIn).user = { email: user.email, name: user.name };
    next();
  }

  app.get("/", (_req, res) => res.redirect("/jobs"));

  app.get("/login", (req, res) => {
    const notice = req.query.expired ? "Your session has expired. Please log in again." : undefined;
    res.send(views.loginPage(undefined, String(req.query.next ?? "/jobs"), notice));
  });

  app.post("/login", (req, res) => {
    const { email = "", password = "", next = "/jobs" } = req.body as Record<string, string>;
    const user = findUser(email);
    if (!user || password !== options.password) {
      return res.status(401).send(views.loginPage("Email or password is incorrect.", next));
    }
    const token = crypto.randomBytes(16).toString("hex");
    db().sessions[token] = { email: user.email, requestsLeft: null };
    save();
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax" });
    res.redirect(next.startsWith("/") ? next : "/jobs");
  });

  app.post("/logout", (req, res) => {
    delete db().sessions[req.cookies[COOKIE]];
    save();
    res.clearCookie(COOKIE);
    res.redirect("/login");
  });

  app.get("/jobs", requireLogin, (req, res) => {
    const { user } = req as SignedIn;
    const query: views.SearchQuery = {
      q: String(req.query.q ?? "").trim(),
      location: String(req.query.location ?? ""),
      minStipend: Number(req.query.minStipend) || 0,
      posted: Number(req.query.posted) || 0,
      page: Math.max(1, Number(req.query.page) || 1),
    };
    const now = Date.now();
    const matching = listJobs()
      .filter((job) => !query.q || matchesKeywords(job, query.q))
      .filter((job) => !query.location || job.location === query.location)
      .filter((job) => !query.minStipend || job.stipendMax >= query.minStipend)
      .filter((job) => !query.posted || now - job.postedOn.getTime() <= query.posted * 86_400_000)
      .sort((a, b) => b.postedOn.getTime() - a.postedOn.getTime());

    const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    const current = Math.min(query.page, pages);
    const slice = matching.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
    const applied = new Set(db().applications.filter((a) => a.email === user.email).map((a) => a.jobId));
    res.send(views.searchPage(user, { ...query, page: current }, slice, matching.length, pages, applied));
  });

  function loadJob(req: Request, res: Response) {
    const job = findJob(Number(req.params.id));
    if (!job) {
      res.status(404).send(views.page("Not found", `<div class="panel"><h1>Posting not found</h1></div>`));
      return undefined;
    }
    return job;
  }

  const applicationFor = (email: string, jobId: number) =>
    db().applications.find((a) => a.email === email && a.jobId === jobId && a.channel === "kaamkaaj");
  const draftFor = (email: string, jobId: number) => db().drafts.find((d) => d.email === email && d.jobId === jobId);

  app.get("/jobs/:id", requireLogin, (req, res) => {
    const { user } = req as SignedIn;
    const job = loadJob(req, res);
    if (!job) return;
    res.send(
      views.jobPage(user, job, applicationFor(user.email, job.id), draftFor(user.email, job.id), options.zentrailUrl),
    );
  });

  // Guards shared by both application steps.
  function applyGuard(req: Request, res: Response) {
    const { user } = req as SignedIn;
    const job = loadJob(req, res);
    if (!job) return undefined;
    if (job.closed) {
      res.status(410).send(views.closedPage(user, job));
      return undefined;
    }
    if (job.externalApply) {
      res.redirect(`${options.zentrailUrl}/jobs/${job.id}/apply`);
      return undefined;
    }
    if (applicationFor(user.email, job.id)) {
      res.redirect(`/jobs/${job.id}`);
      return undefined;
    }
    return job;
  }

  app.get("/jobs/:id/apply", requireLogin, (req, res) => {
    const { user } = req as SignedIn;
    const job = applyGuard(req, res);
    if (!job) return;
    res.send(views.applyDetailsPage(user, job, draftFor(user.email, job.id)));
  });

  app.post("/jobs/:id/apply", requireLogin, upload.single("resume"), (req, res) => {
    const { user } = req as SignedIn;
    const job = applyGuard(req, res);
    if (!job) return;

    const body = req.body as Record<string, string>;
    const existing = draftFor(user.email, job.id);
    const fields = {
      full_name: (body.full_name ?? "").trim(),
      email: (body.email ?? "").trim(),
      phone: (body.phone ?? "").trim(),
      cover_note: (body.cover_note ?? "").trim(),
    };

    const errors: Record<string, string> = {};
    if (!fields.full_name) errors.full_name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(fields.email)) errors.email = "Enter a valid email address.";
    if (fields.phone.replace(/\D/g, "").length < 10) errors.phone = "Enter a 10 digit mobile number.";
    if (fields.cover_note.length < 40) errors.cover_note = "Write at least 40 characters.";
    if (req.file && req.file.mimetype !== "application/pdf") errors.resume = "Upload your resume as a PDF.";
    if (!req.file && !existing?.resumeFile) errors.resume = "Upload your resume.";

    if (Object.keys(errors).length) {
      return res
        .status(422)
        .send(views.applyDetailsPage(user, job, { jobId: job.id, email: user.email, fields, resumeFile: existing?.resumeFile, updatedAt: "" }, errors));
    }

    const draft = existing ?? { jobId: job.id, email: user.email, fields: {}, updatedAt: "" };
    draft.fields = { ...draft.fields, ...fields };
    if (req.file) draft.resumeFile = path.basename(req.file.path);
    draft.updatedAt = new Date().toISOString();
    if (!existing) db().drafts.push(draft);
    save();
    res.redirect(`/jobs/${job.id}/apply/questions`);
  });

  app.get("/jobs/:id/apply/questions", requireLogin, (req, res) => {
    const { user } = req as SignedIn;
    const job = applyGuard(req, res);
    if (!job) return;
    const draft = draftFor(user.email, job.id);
    if (!draft) return res.redirect(`/jobs/${job.id}/apply`);
    res.send(views.applyQuestionsPage(user, job, draft.fields));
  });

  app.post("/jobs/:id/apply/questions", requireLogin, async (req, res) => {
    const { user } = req as SignedIn;
    const job = applyGuard(req, res);
    if (!job) return;
    const draft = draftFor(user.email, job.id);
    if (!draft) return res.redirect(`/jobs/${job.id}/apply`);

    const body = req.body as Record<string, string>;
    const answers: Record<string, string> = {};
    const errors: Record<string, string> = {};
    for (const q of [...job.questions, { name: "declaration", required: true, kind: "checkbox" as const }]) {
      const value = (body[q.name] ?? "").trim();
      if (q.required && !value) errors[q.name] = "This question is required.";
      answers[q.name] = value;
    }
    if (Object.keys(errors).length) {
      return res.status(422).send(views.applyQuestionsPage(user, job, answers, errors));
    }

    const application = {
      applicationId: nextId("kaamkaaj"),
      jobId: job.id,
      email: user.email,
      submittedAt: new Date().toISOString(),
      status: "Submitted" as const,
      channel: "kaamkaaj" as const,
      answers: { ...draft.fields, ...answers },
      resumeFile: draft.resumeFile ?? "",
    };
    db().applications.push(application);
    db().drafts = db().drafts.filter((d) => d !== draft);
    deliverMail({
      to: user.email,
      from: "no-reply@kaamkaaj.test",
      subject: `Application received: ${job.title} at ${job.company}`,
      body: `Hi ${user.name.split(" ")[0]},\n\nYour application for ${job.title} at ${job.company} was submitted on ${shortDate(application.submittedAt)}.\n\nApplication ID: ${application.applicationId}\nStipend: ${rupees(job.stipendMin)}/month\n\nYou can follow its status under My applications.\n\nKaamkaaj`,
    });

    const { submitGlitch: glitch, submitHang: hang } = db().faults;
    db().faults.submitGlitch = false;
    db().faults.submitHang = false;
    save();
    if (hang) await new Promise((r) => setTimeout(r, 30_000));

    // The application is saved either way. With the fault on, the browser
    // only sees a gateway error, which is the ambiguous case worth testing.
    if (glitch) return res.status(502).send(views.badGateway);
    res.send(views.submittedPage(user, job, application));
  });

  app.get("/applications", requireLogin, (req, res) => {
    const { user } = req as SignedIn;
    const rows = db()
      .applications.filter((a) => a.email === user.email && a.channel === "kaamkaaj")
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map((app) => ({ app, job: findJob(app.jobId)! }));
    res.send(views.applicationsPage(user, rows));
  });

  return app;
}
