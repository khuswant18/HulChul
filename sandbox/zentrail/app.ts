import path from "node:path";
import express from "express";
import multer from "multer";
import { db, deliverMail, findJob, nextId, save, uploadsDir } from "../store.ts";
import { esc } from "../html.ts";

// A company careers site with its own look and markup. The operator has no
// special code for it: it has to read this form the same way it reads Kaamkaaj.

const css = `
body{margin:0;background:#101418;color:#e8eaed;font:15px/1.6 Georgia,"Times New Roman",serif}
.wrap{max-width:640px;margin:0 auto;padding:48px 24px}
.logo{font:600 13px/1 ui-monospace,Menlo,monospace;letter-spacing:3px;color:#7fd1ae}
h1{font-weight:400;font-size:30px;margin:18px 0 6px}
p.lead{color:#9aa4ad;margin:0 0 30px}
input,textarea{width:100%;box-sizing:border-box;background:#1a2027;border:1px solid #2c343d;color:#e8eaed;padding:12px;margin:0 0 14px;font:15px/1.4 -apple-system,Segoe UI,sans-serif;border-radius:2px}
textarea{min-height:120px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.upload{border:1px dashed #3a444f;padding:14px;margin-bottom:14px;font:14px -apple-system,Segoe UI,sans-serif;color:#9aa4ad}
.upload input{border:0;padding:6px 0 0;margin:0;background:none}
.consent{display:flex;gap:10px;align-items:flex-start;font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#c3c9cf;margin:6px 0 22px}
.consent input{width:auto;margin-top:4px}
button{background:#7fd1ae;color:#0d1a14;border:0;padding:12px 28px;font:600 15px -apple-system,Segoe UI,sans-serif;cursor:pointer;border-radius:2px}
.err{background:#3a1d1d;border-left:3px solid #e06c6c;padding:10px 14px;margin-bottom:20px;font-family:-apple-system,Segoe UI,sans-serif;font-size:14px}
`;

const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Zentrail Careers</title>
<style>${css}</style></head><body><div class="wrap"><div class="logo">ZENTRAIL / CAREERS</div>${body}</div></body></html>`;

export function createZentrailApp() {
  const app = express();
  const upload = multer({ dest: uploadsDir() });

  function formPage(jobId: number, error?: string) {
    const job = findJob(jobId)!;
    return shell(
      job.title,
      `<h1>${esc(job.title)}</h1>
      <p class="lead">Remote · ₹${job.stipendMin.toLocaleString("en-IN")} a month · ${job.durationMonths} months</p>
      ${error ? `<div class="err" role="alert">${esc(error)}</div>` : ""}
      <form method="post" action="/jobs/${jobId}/apply" enctype="multipart/form-data">
        <input name="fullName" placeholder="Full name" aria-label="Full name" required>
        <div class="row">
          <input name="mail" type="email" placeholder="Email address" aria-label="Email address" required>
          <input name="mobile" type="tel" placeholder="Phone" aria-label="Phone" required>
        </div>
        <div class="upload">CV / resume (PDF)<br><input name="cv" type="file" accept="application/pdf" aria-label="CV / resume (PDF)" required></div>
        <input name="portfolio" type="url" placeholder="GitHub or portfolio URL" aria-label="GitHub or portfolio URL">
        <div class="row">
          <input name="availableFrom" type="date" aria-label="Available from" title="Available from" required>
          <input name="hoursPerWeek" type="number" placeholder="Hours per week" aria-label="Hours per week you can work" required>
        </div>
        <textarea name="motivation" placeholder="What would you like to build at Zentrail?" aria-label="What would you like to build at Zentrail?" required></textarea>
        <label class="consent"><input type="checkbox" name="serviceAgreement" value="accepted" required>
          <span>I understand that interns who accept a pre-placement offer must sign a 12-month service agreement with a ₹50,000 early-exit clause, and I accept this condition.</span></label>
        <button type="submit">Send application</button>
      </form>`,
    );
  }

  app.get("/jobs/:id/apply", (req, res) => {
    const job = findJob(Number(req.params.id));
    if (!job?.externalApply) return res.status(404).send(shell("Not found", "<h1>Role not found</h1>"));
    if (job.closed) return res.status(410).send(shell(job.title, `<h1>This role is closed</h1><p class="lead">We are no longer accepting applications.</p>`));
    res.send(formPage(job.id));
  });

  app.post("/jobs/:id/apply", upload.single("cv"), async (req, res) => {
    const job = findJob(Number(req.params.id));
    if (!job?.externalApply) return res.status(404).send(shell("Not found", "<h1>Role not found</h1>"));
    if (job.closed) return res.status(410).send(shell(job.title, `<h1>This role is closed</h1>`));

    const body = req.body as Record<string, string>;
    const missing = ["fullName", "mail", "mobile", "availableFrom", "hoursPerWeek", "motivation", "serviceAgreement"].filter(
      (k) => !(body[k] ?? "").trim(),
    );
    if (missing.length || !req.file) {
      return res.status(422).send(formPage(job.id, "Please complete every required field and attach your CV."));
    }

    // No duplicate check here, on purpose. Plenty of careers sites accept the
    // same person twice, which is why the operator has to be careful.
    const application = {
      applicationId: nextId("zentrail"),
      jobId: job.id,
      email: body.mail.trim().toLowerCase(),
      submittedAt: new Date().toISOString(),
      status: "Submitted" as const,
      channel: "zentrail" as const,
      answers: body,
      resumeFile: path.basename(req.file.path),
    };
    db().applications.push(application);
    deliverMail({
      to: application.email,
      from: "careers@zentrail.test",
      subject: `We received your application (${application.applicationId})`,
      body: `Hello ${body.fullName.split(" ")[0]},\n\nThanks for applying for ${job.title} at Zentrail. Your reference is ${application.applicationId}.\nWe reply to every applicant within 10 working days.\n\nZentrail Talent Team`,
    });

    const { submitGlitch: glitch, submitHang: hang } = db().faults;
    db().faults.submitGlitch = false;
    db().faults.submitHang = false;
    save();
    if (hang) await new Promise((r) => setTimeout(r, 30_000));
    if (glitch) return res.status(502).send("<html><body><h1>502 Bad Gateway</h1></body></html>");

    res.send(
      shell(
        "Application sent",
        `<h1>Thanks, ${esc(body.fullName.split(" ")[0])}.</h1>
        <p class="lead">We've received your application for ${esc(job.title)}.</p>
        <p>Your reference: <strong>${application.applicationId}</strong></p>
        <p style="color:#9aa4ad">A confirmation has been sent to ${esc(application.email)}.</p>`,
      ),
    );
  });

  return app;
}
