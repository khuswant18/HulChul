# Engineering note

## What I built and why

HulChul is a career agent: it finds jobs for people, applies and follows up. So I built an operator that does the applying part end to end. It takes a goal like *"apply to up to 3 remote frontend internships from the last week paying 15k+"*, works through a job board in a real browser, fills application forms, records everything in the candidate's own spreadsheet, and proves the result from three independent sources.

I built the test environment as well, because the interesting parts only show up when things go wrong on purpose:

- **Kaamkaaj**: a job board with login, search filters, pagination, a two-step application with drafts, and *My applications*.
- **Zentrail**: one employer's own careers site with a different look and different markup (placeholders instead of labels, a bond clause). There is no applications page, so an email is the only proof of an application. This site also accepts duplicate applications without complaint, like many real ones do.
- **Postbox**: webmail where confirmation emails land.
- **Fault switches**: an ambiguous 502, a hanging submit, session expiry, a posting closing mid-run, and the mailbox going down.

The stack is TypeScript end to end, to match HulChul's stack: Node + Express for the sandbox and the operator API, Playwright for the browser, ExcelJS for the tracker, Next.js + React for the console, and the Groq SDK for the model.

## How it is put together

```
goal (text) ──► Mission (typed, validated) ──► search on Kaamkaaj ──► read each posting
                                                                        │
                    shortlist with a reason for every keep/drop ◄───────┘
                                   │
          plan approval (optional) │
                                   ▼
   for each job:  fresh look at posting ─► read form by labels ─► plan each field
                  (closed? applied?)        (any site)             safety rules first,
                                                                   then profile, then model
                        ▼                                                │
                  ask the human if needed ◄──────────────────────────────┘
                        ▼
                  mark "submitting" on disk ─► click ─► confirmation?  ── yes ─► tracker row
                                                          │ no/unclear
                                                          ▼
                                     check board / inbox in a second tab
                                     found → record it (no resubmit)
                                     not found → retry once
                                     can't check → stop, leave "submitting"
                        ▼
   verify from scratch: new browser session, board + inbox + xlsx on disk ─► report.html
```

The same `Run` class starts a run and resumes one. Every phase first asks the journal what is already done.

## Decisions worth explaining

**The model is kept out of the control flow.** Navigation, retries, the shortlist and the safety checks are plain code. A Groq-hosted model is used where language actually matters:

- turning the goal into a `Mission`,
- writing free-text answers (cover note, "why us", "describe a project"),
- mapping form fields the rules don't recognise.

Each call has a zod schema, and every call has a rules fallback, so the operator works with no API key at all and degrades gracefully on API errors, rate limits, invalid JSON or truncated output. After a rejected key it stops calling the API for the rest of the run. For a system that submits things on someone's behalf, I wanted the behaviour that decides *whether* to act to be deterministic and testable. The model only helps decide *what to write*.

**Deterministic safety rules can't be overridden.** Before the profile or the model sees a field, `safetyCheck` classifies agreement checkboxes: money (fees, deposits, ₹ amounts), contract terms (bonds, service agreements, exit clauses), and ID/bank/date-of-birth data. The first two need your authority or your approval. The third is always asked.

A bug the tests caught shaped this: a bond clause that mentions "₹50,000" was being treated as a fee. Now a label is classified once, as a commitment first. Allowing fees does not unlock a bond.

**Model output has to show its evidence.** When the model fills an unknown field from the profile, it must quote the profile text it used. That quote is checked with a substring match against the real profile, and options must match the form's options exactly. Anything it can't back up goes to the human.

**Never retry a submit blindly.** The most dangerous failure for this workflow is the ambiguous one: the server saved the application, but the browser saw an error or nothing at all. Retrying creates a duplicate application, which looks bad to an employer. So:

1. Before clicking the final submit, the job is written to disk as `submitting`.
2. After a non-confirmation (5xx, timeout, session loss), the operator opens a second tab and looks for proof: *My applications* on the board, or an unknown confirmation email in Postbox for external sites.
3. If it finds one, it records it as recovered. If it finds nothing, it retries once. If it can't check (mailbox down), it stops, explains why, and leaves the job as `submitting`, so a later resume checks again before doing anything.

The same path handles a process that dies mid-click: on resume, anything still `submitting` is reconciled first.

**Verification does not trust the run's memory.** It uses a fresh browser context and re-reads the board, the inbox and the xlsx file on disk. For each application it checks: on the board (where applicable), confirmation email, exactly one tracker row, no duplicates, and still meets the goal's filters. "Goal met" needs every target application fully verified. Skipped, blocked and unproven work is listed under *Not done* in both the console and the report.

**Site-specific navigation, generic forms.** Searching Kaamkaaj uses a small adapter (labels and roles, not CSS paths), because the board is a known app. Application forms are read generically by label, aria-label, placeholder or fieldset legend, because every employer's form is different. Zentrail's form is handled by the same code as Kaamkaaj's, with no special case for it.

**The human stays in charge of scope, not every click.** Authority is explicit: max applications, fees, contract terms, confirm the plan, confirm each submit. Pause is checked before every browser action, so it takes effect within one action. Stop never leaves a half-submitted form behind; it still verifies and reports what was done.

**Small things that mattered in practice:**

- Board search filters are coarse, so every constraint is re-checked locally with a reason.
- The tracker is keyed by application ID and written through a temp file, so reruns update rows instead of duplicating them.
- Screenshots are numbered and never overwritten across resumes.
- The field being asked about is outlined in the screenshot, so an approval shows exactly what it is about.

## How the requirements map to the code

| Asked for | Where |
| --- | --- |
| Working execution | `runner.ts`, `apply.ts`, `sites/`, real Chromium via Playwright. Outputs: board applications, tracker rows, report |
| Variation without code change | Different goals and profiles (Meera, data analyst). Different forms read by `forms.ts` |
| Recovery | `apply.ts` (`findExistingApplication`, `submitting` state), `Kaamkaaj.recoverSession`, `Run.resume`, sandbox faults |
| Verified completion | `verify.ts`, `report.ts`, verification table and *Not done* list in the console |
| Human control | `control.ts` (pause/stop/approvals), authority in `types.ts`, `answers.ts#safetyCheck`, console `ApprovalCard` |

## Testing

- **Unit tests** (`npm test`, 22 tests): goal parsing, safety rules, shortlist filters, tracker idempotency, and pause/stop/approval behaviour.
- **End-to-end scenarios**, each run against the sandbox with the application count checked on the board afterwards:
  - the main task and the variation,
  - 502 on Kaamkaaj and on Zentrail,
  - Zentrail 502 with Postbox down,
  - a hanging submit,
  - session expiry mid-application,
  - a posting closing mid-run,
  - a `kill -9` during a submit followed by resume,
  - killing the API server and resuming from the console.

  None of them produced a duplicate application.

## Tools and AI assistance

I used **Claude Code** (Anthropic's AI coding assistant) throughout: for scaffolding, writing most of the code, running the end-to-end scenarios and fixing what they exposed. I reviewed the design decisions and the code, and I can walk through and change any part of it.

*My own contribution:* _[fill in: what you decided, wrote, reviewed or changed yourself]_

*Time spent:* _[fill in]_

Libraries used: Playwright, Express, Multer, ExcelJS, pdf-lib, zod, Next.js/React, groq-sdk.

## Model and account requirements

- None are required to run it. Rules-only mode covers every scenario above.
- With `GROQ_API_KEY` set, the default model is `openai/gpt-oss-120b` on Groq (change it with `OPERATOR_MODEL`; `openai/gpt-oss-20b` also works). It is called with strict JSON-schema output and low reasoning effort, and the answer is validated again with zod before use.
- Only models that support Groq's strict JSON-schema mode will work well. Others fall back to the rules.
- The Groq path was tested up to the API boundary without a real key: the schema, the request, and the fallback when the key is rejected. Do a live run with a real key before relying on it.
- Groq's free tier has rate limits. When a limit is hit, that call falls back to the rules and the run continues.
- No real credentials are in the repo. The sandbox password in `.env.example` is a demo value.

## Limitations

- **It's a sandbox.** Real job boards add CAPTCHAs, bot detection, OAuth logins and terms of service that forbid automation. A production version would need official APIs or partnerships where they exist, and the user's explicit consent per site.
- **Forms:** only standard HTML controls. No custom JavaScript dropdowns, rich text editors or multi-file uploads.
- **Kaamkaaj navigation is an adapter.** A new job board needs a new adapter, or the fallback described below.
- **Runs one at a time,** one job after another. Approvals block the run instead of letting it continue with other jobs.
- **Confirmation detection** relies on page text patterns ("Application ID", "Reference"). A site with an unusual confirmation page would fall into the reconcile path, which is safe but slower.
- **Matching** is skill overlap. It's easy to explain, but it doesn't understand that "Next.js" implies React.
- **No auth on the operator API or console.** It is meant to run locally only.

## What I would build next

1. **Approvals over WhatsApp,** since that's where HulChul users already are: "Ledgerly wants a ₹499 fee. Reply 1 to agree, 2 to skip."
2. **A model-driven navigation fallback** for unknown sites: an accessibility-tree agent with the same typed actions, the same checkpoints and the same safety rules, used only when no adapter exists.
3. **Follow-up:** watch the inbox for replies, update the tracker status (interview, rejected), and draft follow-ups after N days.
4. **An eval set** for the language parts: goal parsing against a labelled set of goals, and a rubric for cover notes (grounded, specific, no invented claims), run on every prompt change.
5. **Keep going while waiting on a question:** move on to other jobs, then come back.
6. **Job queue and multi-user isolation** (per-user browser profiles and secrets) so it can serve many users at once.
