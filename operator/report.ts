import fs from "node:fs";
import path from "node:path";
import type { CheckResult, RunState } from "./types.ts";

// A single HTML file per run that someone can open without the console:
// what was asked, what was done, what was proven and what is still missing.

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const mark = (r: CheckResult) =>
  ({ pass: `<span class="ok">yes</span>`, fail: `<span class="bad">no</span>`, unknown: `<span class="warn">unknown</span>`, "n/a": `<span class="muted">n/a</span>` })[r];

export function renderReport(s: RunState) {
  const v = s.verification;
  const apps = Object.values(s.applications);

  const verificationRows = v?.jobs.length
    ? v.jobs
        .map(
          (j) => `<tr><td>${esc(j.company)}<div class="muted">${esc(j.title)}</div></td><td class="mono">${esc(j.applicationId)}</td>
          <td>${mark(j.board)}</td><td>${mark(j.email)}</td><td>${mark(j.tracker)}</td><td>${mark(j.duplicates)}</td><td>${mark(j.filters)}</td>
          <td><b class="${j.verdict === "verified" ? "ok" : j.verdict === "partly verified" ? "warn" : "bad"}">${esc(j.verdict)}</b>${j.notes.length ? `<div class="muted">${esc(j.notes.join("; "))}</div>` : ""}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="8" class="muted">No applications were submitted.</td></tr>`;

  const answers = apps
    .filter((a) => a.answers.length)
    .map(
      (a) => `<details><summary>${esc(a.company)} · ${esc(a.title)} <span class="muted">(${esc(a.status)}${a.applicationId ? `, ${esc(a.applicationId)}` : ""})</span></summary>
      <table><thead><tr><th>Field</th><th>Value sent</th><th>Where it came from</th></tr></thead><tbody>
      ${a.answers.map((x) => `<tr><td>${esc(x.label)}</td><td>${esc(x.value)}</td><td class="muted">${esc(x.source)}</td></tr>`).join("")}
      </tbody></table></details>`,
    )
    .join("");

  const shots = [
    ...(v?.evidence ?? []),
    ...apps.filter((a) => a.screenshot).map((a) => ({ label: `${a.company}: ${a.status}${a.applicationId ? ` (${a.applicationId})` : ""}`, screenshot: a.screenshot! })),
  ];

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Run ${esc(s.id)} · Evidence report</title>
<style>
:root{--paper:#f2f2ef;--ink:#17181a;--muted:#6e7075;--rule:#deded9;--ok:#1d6b52;--bad:#b3261e;--warn:#8a5300}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.55 "IBM Plex Sans",-apple-system,"Segoe UI",sans-serif}
main{max-width:1040px;margin:0 auto;padding:40px 24px 80px}
h1{font-size:24px;margin:0 0 6px;font-weight:600}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:40px 0 10px;font-weight:600;border-bottom:1px solid var(--rule);padding-bottom:6px}
.goal{font-size:17px;margin:8px 0 18px;max-width:780px}
.meta{display:flex;flex-wrap:wrap;gap:6px 28px;color:var(--muted);font-size:13px}.meta b{color:var(--ink);font-weight:500}
.outcome{margin:22px 0 0;padding:14px 16px;border-left:3px solid var(--ink);background:#fff}
.mono{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-size:12.5px}
table{width:100%;border-collapse:collapse;background:#fff}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--rule);vertical-align:top}
th{font-size:12px;font-weight:600;color:var(--muted)}
.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}.muted{color:var(--muted);font-size:12.5px}
ul.gaps{margin:0;padding-left:18px}ul.gaps li{margin:4px 0}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
figure{margin:0;background:#fff;border:1px solid var(--rule)}figure img{width:100%;display:block;border-bottom:1px solid var(--rule)}figcaption{padding:8px 10px;font-size:12.5px}
details{background:#fff;border:1px solid var(--rule);margin-bottom:8px}summary{cursor:pointer;padding:9px 12px}details table{border-top:1px solid var(--rule)}
ol.steps{list-style:none;padding:0;margin:0;font-size:13px}ol.steps li{display:grid;grid-template-columns:70px 80px 1fr;gap:10px;padding:5px 0;border-bottom:1px dashed var(--rule)}
ol.steps .error{color:var(--bad)}ol.steps .warn{color:var(--warn)}ol.steps .success{color:var(--ok)}
pre{white-space:pre-wrap;font:inherit;margin:0}
</style></head><body><main>
<div class="muted mono">Run ${esc(s.id)}</div>
<h1>Evidence report</h1>
<p class="goal">“${esc(s.goal)}”</p>
<div class="meta">
  <span>Profile <b>${esc(s.profileName)}</b></span>
  <span>Status <b>${esc(s.status)}</b></span>
  <span>Started <b>${new Date(s.createdAt).toLocaleString("en-IN")}</b></span>
  ${s.finishedAt ? `<span>Finished <b>${new Date(s.finishedAt).toLocaleString("en-IN")}</b></span>` : ""}
  <span>Reasoning <b>${s.llm.mode === "groq" ? `Groq (${esc(s.llm.model)}), ${s.llm.calls} calls, ${s.llm.fallbacks} fallbacks` : "rules only"}</b></span>
  ${s.resumedCount ? `<span>Resumed <b>${s.resumedCount}×</b></span>` : ""}
</div>
<div class="outcome">${esc(s.outcome ?? "Still running")}</div>

<h2>How the goal was read</h2>
${s.mission ? `<p>${esc(s.mission.summary)}</p>${s.mission.assumptions.length ? `<ul class="gaps">${s.mission.assumptions.map((a) => `<li class="warn">${esc(a)}</li>`).join("")}</ul>` : ""}` : `<p class="muted">Not reached.</p>`}
<p class="muted">Authority given: up to ${s.authority.maxApplications} applications, fees ${s.authority.allowFees ? "allowed" : "need approval"}, contract terms ${s.authority.allowCommitments ? "allowed" : "need approval"}, shortlist ${s.authority.confirmPlan ? "confirmed by you" : "not confirmed"}, submits ${s.authority.confirmEachSubmit ? "confirmed one by one" : "automatic within these limits"}.</p>

<h2>Verification</h2>
<table><thead><tr><th>Job</th><th>ID</th><th>On board</th><th>Email</th><th>Tracker</th><th>No duplicate</th><th>Meets goal</th><th>Verdict</th></tr></thead><tbody>${verificationRows}</tbody></table>

<h2>Not done</h2>
${v?.gaps.length ? `<ul class="gaps">${v.gaps.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : `<p class="muted">Nothing outstanding.</p>`}

<h2>Evidence</h2>
${shots.length ? `<div class="shots">${shots.map((x) => `<figure><a href="${esc(x.screenshot)}"><img src="${esc(x.screenshot)}" alt="${esc(x.label)}" loading="lazy"></a><figcaption>${esc(x.label)}</figcaption></figure>`).join("")}</div>` : `<p class="muted">No screenshots.</p>`}

<h2>What was sent</h2>
${answers || `<p class="muted">No forms were filled.</p>`}

<h2>Shortlist</h2>
<table><thead><tr><th>#</th><th>Job</th><th>Fit</th><th>Why</th><th>Result</th></tr></thead><tbody>
${s.plan.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.company)}<div class="muted">${esc(p.title)}</div></td><td>${p.fit}%</td><td class="muted">${esc(p.reasons.join(" · "))}</td><td>${esc(s.applications[String(p.boardId)]?.status ?? "not needed")}</td></tr>`).join("")}
</tbody></table>
${s.rejected.length ? `<details style="margin-top:10px"><summary>${s.rejected.length} posting(s) left out</summary><table><tbody>${s.rejected.map((r) => `<tr><td>${esc(r.company)} · ${esc(r.title)}</td><td class="muted">${esc(r.reason)}</td></tr>`).join("")}</tbody></table></details>` : ""}

<h2>Your decisions</h2>
${
  s.approvals.length
    ? `<table><tbody>${s.approvals
        .map((a) => `<tr><td>${esc(a.title)}</td><td>${a.decision ? esc(a.options.find((o) => o.value === a.decision!.value)?.label ?? a.decision.value) + (a.decision.text ? `: “${esc(a.decision.text)}”` : "") : `<span class="warn">waiting</span>`}</td></tr>`)
        .join("")}</tbody></table>`
    : `<p class="muted">No approvals were needed.</p>`
}

<h2>Timeline</h2>
<ol class="steps">${s.steps.map((st) => `<li class="${st.level}"><span class="mono muted">${time(st.at)}</span><span class="muted">${st.phase}</span><span>${esc(st.message)}${st.screenshot ? ` · <a href="${esc(st.screenshot)}">screenshot</a>` : ""}</span></li>`).join("")}</ol>
</main></body></html>`;
}

export function writeReport(state: RunState, dir: string) {
  const file = path.join(dir, "report.html");
  fs.writeFileSync(file, renderReport(state));
  return file;
}
