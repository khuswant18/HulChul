import type { Application, Draft, Job } from "../store.ts";
import { daysAgoText, demoAccounts, esc, shortDate, stipendText } from "../html.ts";
import { users, type Question } from "../seed.ts";

const css = `
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 "Segoe UI",Roboto,Arial,sans-serif;color:#1f2933;background:#eef1f4}
a{color:#0b6bcb;text-decoration:none}a:hover{text-decoration:underline}
header.top{background:#0b4f8a;color:#fff}
header.top .in{max-width:1080px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;gap:28px}
.brand{font-weight:700;font-size:20px;letter-spacing:-.3px;color:#fff}
.brand span{color:#ffc84a}
header.top nav{display:flex;gap:18px;flex:1}
header.top nav a{color:#d9e7f5}
header.top .who{font-size:13px;color:#d9e7f5}
header.top .who form{display:inline}
header.top .who button{background:none;border:0;color:#ffc84a;cursor:pointer;font:inherit;padding:0 0 0 8px}
main{max-width:1080px;margin:0 auto;padding:22px 20px 60px}
h1{font-size:22px;margin:0 0 4px}
h2{font-size:16px;margin:24px 0 8px}
.panel{background:#fff;border:1px solid #d8dee4;border-radius:4px;padding:18px 20px}
.layout{display:grid;grid-template-columns:250px 1fr;gap:20px;align-items:start}
.filters label{display:block;font-weight:600;font-size:12px;color:#52606d;margin:12px 0 4px;text-transform:uppercase;letter-spacing:.3px}
.filters input,.filters select{width:100%}
input,select,textarea{font:inherit;padding:7px 9px;border:1px solid #b8c2cc;border-radius:3px;background:#fff}
textarea{width:100%;min-height:110px}
button,.btn{display:inline-block;font:inherit;font-weight:600;padding:8px 16px;border-radius:3px;border:1px solid #0b6bcb;background:#0b6bcb;color:#fff;cursor:pointer}
.btn.secondary{background:#fff;color:#0b6bcb}
.filters button{margin-top:16px;width:100%}
.count{color:#52606d;margin:0 0 10px}
.job-card{background:#fff;border:1px solid #d8dee4;border-radius:4px;padding:14px 18px;margin-bottom:10px}
.job-card h3{margin:0;font-size:16px}
.job-card .company{color:#52606d;margin:2px 0 8px}
.job-card .meta{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;color:#3e4c59}
.tag{display:inline-block;font-size:12px;padding:1px 8px;border-radius:10px;background:#e6f0fa;color:#0b4f8a;margin-left:8px;font-weight:600}
.tag.applied{background:#e3f4e8;color:#1c6b37}
.tag.closed{background:#f5e1e1;color:#8a1c1c}
.pager{display:flex;gap:14px;align-items:center;margin-top:14px}
dl.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px 18px;margin:18px 0}
dl.facts dt{font-size:12px;color:#52606d;text-transform:uppercase;letter-spacing:.3px}
dl.facts dd{margin:0;font-weight:600}
ul.skills{list-style:none;padding:0;margin:0;display:flex;gap:6px;flex-wrap:wrap}
ul.skills li{background:#eef1f4;border:1px solid #d8dee4;padding:2px 10px;border-radius:12px;font-size:13px}
.notice{padding:10px 14px;border-radius:3px;margin:16px 0}
.notice.applied{background:#e3f4e8;border:1px solid #9fd4ae}
.notice.closed{background:#f5e1e1;border:1px solid #e0a3a3}
.notice.info{background:#fff8e1;border:1px solid #f0d58c}
.steps{color:#52606d;font-size:13px;margin-bottom:12px}
.field{margin:0 0 16px}
.field>label,.field legend{display:block;font-weight:600;margin-bottom:5px}
.field input[type=text],.field input[type=email],.field input[type=password],.field input[type=tel],.field input[type=url],.field input[type=number],.field input[type=date],.field select{width:100%;max-width:420px}
fieldset.field{border:0;padding:0}
fieldset.field label{font-weight:400;margin-right:18px}
.check label{font-weight:400}
.req{color:#b42318}
.field-error{color:#b42318;font-size:13px;margin-top:4px}
.errors{background:#fdecea;border:1px solid #f1aeb5;padding:10px 14px;margin-bottom:16px;border-radius:3px}
table{width:100%;border-collapse:collapse;background:#fff}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #e4e7eb}
th{font-size:12px;color:#52606d;text-transform:uppercase;letter-spacing:.3px;background:#f7f9fa}
.login{max-width:380px;margin:40px auto}
.login .field input{max-width:none}
footer{color:#7b8794;font-size:12px;text-align:center;padding:20px}
`;

export function page(title: string, body: string, user?: { name: string } | null) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Kaamkaaj</title><style>${css}</style></head>
<body>
<header class="top"><div class="in">
  <a class="brand" href="/jobs">kaam<span>kaaj</span></a>
  <nav>${user ? `<a href="/jobs">Find internships</a><a href="/applications">My applications</a>` : ""}</nav>
  <div class="who">${
    user
      ? `Signed in as ${esc(user.name)}<form method="post" action="/logout"><button>Log out</button></form>`
      : `<a href="/login" style="color:#ffc84a">Log in</a>`
  }</div>
</div></header>
<main>${body}</main>
<footer>Kaamkaaj is a sandbox job board. All listings are synthetic.</footer>
</body></html>`;
}

export function loginPage(password: string, error?: string, next = "/jobs", notice?: string) {
  return page(
    "Log in",
    `<div class="login panel">
      <h1>Log in</h1>
      <p style="color:#52606d;margin-top:0">Apply to internships and track your applications.</p>
      ${notice ? `<p class="notice info" role="status">${esc(notice)}</p>` : ""}
      ${error ? `<p class="errors" role="alert">${esc(error)}</p>` : ""}
      ${demoAccounts(users, password, "#0b6bcb")}
      <form method="post" action="/login">
        <input type="hidden" name="next" value="${esc(next)}">
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required></div>
        <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" required></div>
        <button type="submit">Log in</button>
      </form>
    </div>`,
  );
}

const locations = ["Remote", "Bengaluru", "Pune", "Mumbai", "Hyderabad", "Gurugram"];
const stipendSteps = [5000, 10000, 15000, 20000, 30000];
const postedSteps = [1, 3, 7, 14, 30];

export interface SearchQuery {
  q: string;
  location: string;
  minStipend: number;
  posted: number;
  page: number;
}

export function searchPage(
  user: { name: string },
  query: SearchQuery,
  results: Job[],
  total: number,
  pages: number,
  appliedIds: Set<number>,
) {
  const option = (value: string | number, label: string, current: string | number) =>
    `<option value="${esc(value)}"${String(value) === String(current) ? " selected" : ""}>${esc(label)}</option>`;

  const cards = results
    .map(
      (job) => `<article class="job-card" data-job-id="${job.id}">
        <h3><a href="/jobs/${job.id}">${esc(job.title)}</a>
          ${appliedIds.has(job.id) ? `<span class="tag applied">Applied</span>` : ""}
          ${job.closed ? `<span class="tag closed">Closed</span>` : ""}
          ${job.externalApply ? `<span class="tag">Company site</span>` : ""}</h3>
        <div class="company">${esc(job.company)}</div>
        <div class="meta">
          <span>${esc(job.location)}${job.mode !== "Remote" ? ` · ${esc(job.mode)}` : ""}</span>
          <span>${stipendText(job.stipendMin, job.stipendMax)}</span>
          <span>${job.durationMonths} months</span>
          <span>Posted ${daysAgoText(job.postedOn)}</span>
        </div>
      </article>`,
    )
    .join("");

  const link = (p: number) => {
    const params = new URLSearchParams({
      q: query.q,
      location: query.location,
      minStipend: String(query.minStipend || ""),
      posted: String(query.posted || ""),
      page: String(p),
    });
    return `/jobs?${params}`;
  };

  return page(
    "Find internships",
    `<div class="layout">
      <form class="panel filters" method="get" action="/jobs" role="search">
        <label for="q">Keywords</label>
        <input id="q" name="q" type="text" value="${esc(query.q)}" placeholder="e.g. frontend, data analyst">
        <label for="location">Location</label>
        <select id="location" name="location">
          ${option("", "Any location", query.location)}
          ${locations.map((l) => option(l, l, query.location)).join("")}
        </select>
        <label for="minStipend">Minimum stipend</label>
        <select id="minStipend" name="minStipend">
          ${option("", "Any", query.minStipend || "")}
          ${stipendSteps.map((s) => option(s, `₹${s.toLocaleString("en-IN")}+`, query.minStipend)).join("")}
        </select>
        <label for="posted">Posted within</label>
        <select id="posted" name="posted">
          ${option("", "Any time", query.posted || "")}
          ${postedSteps.map((d) => option(d, d === 1 ? "Last 24 hours" : `Last ${d} days`, query.posted)).join("")}
        </select>
        <button type="submit">Search</button>
      </form>
      <section aria-label="Search results">
        <h1>Internships</h1>
        <p class="count">${total} ${total === 1 ? "result" : "results"}${query.q ? ` for “${esc(query.q)}”` : ""}</p>
        ${cards || `<div class="panel">No internships match these filters.</div>`}
        ${
          pages > 1
            ? `<nav class="pager" aria-label="Pagination">
                ${query.page > 1 ? `<a rel="prev" href="${link(query.page - 1)}">← Previous</a>` : ""}
                <span>Page ${query.page} of ${pages}</span>
                ${query.page < pages ? `<a rel="next" href="${link(query.page + 1)}">Next →</a>` : ""}
              </nav>`
            : ""
        }
      </section>
    </div>`,
    user,
  );
}

export function jobPage(
  user: { name: string },
  job: Job,
  application: Application | undefined,
  draft: Draft | undefined,
  zentrailUrl: string,
) {
  let action: string;
  if (application) {
    action = `<p class="notice applied" role="status">You applied on ${shortDate(application.submittedAt)} · Application ID <strong>${esc(application.applicationId)}</strong></p>`;
  } else if (job.closed) {
    action = `<p class="notice closed" role="status">This posting is no longer accepting applications.</p>`;
  } else if (job.externalApply) {
    action = `<p><a class="btn" href="${zentrailUrl}/jobs/${job.id}/apply">Apply on company site</a></p>
      <p style="color:#52606d;font-size:13px">${esc(job.company)} takes applications on its own careers site.</p>`;
  } else if (draft) {
    action = `<p class="notice info">You have an unfinished application for this internship.</p>
      <p><a class="btn" href="/jobs/${job.id}/apply">Continue application</a></p>`;
  } else {
    action = `<p><a class="btn" href="/jobs/${job.id}/apply">Apply now</a></p>`;
  }

  return page(
    job.title,
    `<div class="panel" data-job-id="${job.id}">
      <p style="margin:0 0 6px"><a href="/jobs">← Back to search</a></p>
      <h1>${esc(job.title)}</h1>
      <div style="color:#52606d;font-size:15px">${esc(job.company)}</div>
      <dl class="facts">
        <div><dt>Location</dt><dd>${esc(job.location)}</dd></div>
        <div><dt>Work mode</dt><dd>${esc(job.mode)}</dd></div>
        <div><dt>Stipend</dt><dd>${stipendText(job.stipendMin, job.stipendMax)}</dd></div>
        <div><dt>Duration</dt><dd>${job.durationMonths} months</dd></div>
        <div><dt>Type</dt><dd>${esc(job.type)}</dd></div>
        <div><dt>Posted on</dt><dd>${shortDate(job.postedOn)}</dd></div>
        <div><dt>Apply by</dt><dd>${shortDate(job.deadline)}</dd></div>
      </dl>
      <h2>Skills required</h2>
      <ul class="skills" aria-label="Skills required">${job.skills.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <h2>About ${esc(job.company)}</h2>
      <p>${esc(job.about)}</p>
      <h2>What you will do</h2>
      <ul>${job.responsibilities.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      ${action}
    </div>`,
    user,
  );
}

function questionField(q: Question, value: string, error?: string) {
  const req = q.required ? ` <span class="req" aria-hidden="true">*</span>` : "";
  const required = q.required ? " required" : "";
  const err = error ? `<div class="field-error" role="alert">${esc(error)}</div>` : "";
  const id = `q_${q.name}`;

  switch (q.kind) {
    case "textarea":
      return `<div class="field"><label for="${id}">${esc(q.label)}${req}</label><textarea id="${id}" name="${q.name}"${required}>${esc(value)}</textarea>${err}</div>`;
    case "select":
      return `<div class="field"><label for="${id}">${esc(q.label)}${req}</label><select id="${id}" name="${q.name}"${required}>
        <option value="">Select…</option>
        ${(q.options ?? []).map((o) => `<option${o === value ? " selected" : ""}>${esc(o)}</option>`).join("")}
      </select>${err}</div>`;
    case "yesno":
      return `<fieldset class="field"><legend>${esc(q.label)}${req}</legend>
        ${["Yes", "No"]
          .map(
            (o) =>
              `<label><input type="radio" name="${q.name}" value="${o}"${value === o ? " checked" : ""}${required}> ${o}</label>`,
          )
          .join("")}${err}</fieldset>`;
    case "checkbox":
      return `<div class="field check"><label><input type="checkbox" name="${q.name}" value="yes"${value === "yes" ? " checked" : ""}${required}> ${esc(q.label)}${req}</label>${err}</div>`;
    default:
      return `<div class="field"><label for="${id}">${esc(q.label)}${req}</label><input id="${id}" name="${q.name}" type="${q.kind}" value="${esc(value)}"${required}>${err}</div>`;
  }
}

export function applyDetailsPage(user: { name: string }, job: Job, draft: Draft | undefined, errors: Record<string, string> = {}) {
  const f = draft?.fields ?? {};
  const err = (k: string) => (errors[k] ? `<div class="field-error" role="alert">${esc(errors[k])}</div>` : "");
  return page(
    `Apply · ${job.title}`,
    `<div class="panel" style="max-width:720px">
      <div class="steps">Step 1 of 2 · Your details</div>
      <h1>Apply to ${esc(job.title)}</h1>
      <p style="color:#52606d;margin-top:0">${esc(job.company)} · ${esc(job.location)}</p>
      ${Object.keys(errors).length ? `<div class="errors" role="alert">Please fix the highlighted fields.</div>` : ""}
      <form method="post" action="/jobs/${job.id}/apply" enctype="multipart/form-data">
        <div class="field"><label for="full_name">Full name <span class="req">*</span></label><input id="full_name" name="full_name" type="text" value="${esc(f.full_name)}" required>${err("full_name")}</div>
        <div class="field"><label for="email">Email <span class="req">*</span></label><input id="email" name="email" type="email" value="${esc(f.email)}" required>${err("email")}</div>
        <div class="field"><label for="phone">Mobile number <span class="req">*</span></label><input id="phone" name="phone" type="tel" value="${esc(f.phone)}" required>${err("phone")}</div>
        <div class="field"><label for="resume">Resume (PDF)${draft?.resumeFile ? "" : ` <span class="req">*</span>`}</label>
          <input id="resume" name="resume" type="file" accept="application/pdf"${draft?.resumeFile ? "" : " required"}>
          ${draft?.resumeFile ? `<div style="font-size:13px;color:#1c6b37;margin-top:4px">Resume uploaded. Upload again to replace it.</div>` : ""}
          ${err("resume")}</div>
        <div class="field"><label for="cover_note">Cover note <span class="req">*</span></label><textarea id="cover_note" name="cover_note" required>${esc(f.cover_note)}</textarea>${err("cover_note")}</div>
        <button type="submit">Save and continue</button>
      </form>
    </div>`,
    user,
  );
}

export function applyQuestionsPage(user: { name: string }, job: Job, values: Record<string, string>, errors: Record<string, string> = {}) {
  return page(
    `Apply · ${job.title}`,
    `<div class="panel" style="max-width:720px">
      <div class="steps">Step 2 of 2 · Screening questions</div>
      <h1>A few questions from ${esc(job.company)}</h1>
      ${Object.keys(errors).length ? `<div class="errors" role="alert">Please answer the required questions.</div>` : ""}
      <form method="post" action="/jobs/${job.id}/apply/questions">
        ${job.questions.map((q) => questionField(q, values[q.name] ?? "", errors[q.name])).join("")}
        ${questionField(
          { name: "declaration", label: "I confirm that the information in this application is accurate.", kind: "checkbox", required: true },
          values.declaration ?? "",
          errors.declaration,
        )}
        <p><a href="/jobs/${job.id}/apply">← Back to details</a></p>
        <button type="submit">Submit application</button>
      </form>
    </div>`,
    user,
  );
}

export function submittedPage(user: { name: string }, job: Job, app: Application) {
  return page(
    "Application submitted",
    `<div class="panel" style="max-width:720px">
      <h1>Application submitted</h1>
      <p>Your application for <strong>${esc(job.title)}</strong> at ${esc(job.company)} has been sent.</p>
      <p>Your application ID is <strong data-application-id>${esc(app.applicationId)}</strong>. We have emailed you a copy.</p>
      <p><a href="/applications">Go to My applications</a> · <a href="/jobs">Find more internships</a></p>
    </div>`,
    user,
  );
}

export function closedPage(user: { name: string }, job: Job) {
  return page(
    "Posting closed",
    `<div class="panel"><h1>${esc(job.title)}</h1>
      <p class="notice closed" role="alert">This posting is no longer accepting applications.</p>
      <p><a href="/jobs">Back to search</a></p></div>`,
    user,
  );
}

export function applicationsPage(user: { name: string }, rows: { app: Application; job: Job }[]) {
  return page(
    "My applications",
    `<h1>My applications</h1>
    <p class="count">${rows.length} ${rows.length === 1 ? "application" : "applications"}</p>
    ${
      rows.length
        ? `<table aria-label="My applications">
            <thead><tr><th>Application ID</th><th>Role</th><th>Company</th><th>Applied on</th><th>Status</th></tr></thead>
            <tbody>${rows
              .map(
                ({ app, job }) => `<tr data-job-id="${job.id}">
                  <td>${esc(app.applicationId)}</td>
                  <td><a href="/jobs/${job.id}">${esc(job.title)}</a></td>
                  <td>${esc(job.company)}</td>
                  <td>${shortDate(app.submittedAt)}</td>
                  <td>${esc(app.status)}</td></tr>`,
              )
              .join("")}</tbody></table>`
        : `<div class="panel">You have not applied to anything yet.</div>`
    }`,
    user,
  );
}

export const badGateway = `<html><head><title>502 Bad Gateway</title></head><body>
<center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></body></html>`;
