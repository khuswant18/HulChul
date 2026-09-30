# Career Operator

A small computer operator for job seekers. You give it a goal in plain English, for example:

> Apply to up to 3 remote frontend or full-stack internships posted in the last week that pay at least ₹15,000 a month.

It then:

1. reads the goal and the candidate's profile file,
2. logs in to a job board in a real Chromium window, searches, and reads every posting,
3. shortlists jobs with a written reason for every job it keeps or drops,
4. fills and submits the application forms (including one on a company's own careers site),
5. writes each application into the candidate's tracker spreadsheet (`.xlsx`),
6. checks its own work: the job board, the candidate's inbox and the spreadsheet must all agree,
7. writes an evidence report with screenshots.

It asks you before doing anything outside the limits you gave it (paying a fee, accepting a bond, sending more applications than allowed, answering something your profile doesn't cover). You can pause or stop it at any point. If it crashes mid-submit, it can resume without applying twice.

I picked this workflow because it is the core of what HulChul does for its users: find matching jobs, apply, and follow up. It needs a browser, files and a second app (email), and it has real ways to go wrong.

Everything runs locally against a sandbox I control. All companies, people and jobs are synthetic.

## Requirements

- Node.js 20 or newer (built and tested on Node 24)
- About 300 MB for Chromium (installed by Playwright)
- Optional: a Groq API key (free at https://console.groq.com/keys). Without one, the operator runs in rules-only mode and every feature still works. With one, a Groq-hosted model (`openai/gpt-oss-120b` by default) reads the goal, writes the free-text answers and maps unfamiliar form fields. See the engineering note for exactly where.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env          # add GROQ_API_KEY here if you have one
npm run setup                 # creates resumes (PDF), trackers (xlsx) and resets the sandbox
npm run dev                   # starts everything below
```

Open **http://localhost:3000**.

| What | URL | Notes |
| --- | --- | --- |
| Operator console (Next.js) | http://localhost:3000 | Start runs, watch progress, approve, pause, stop |
| Operator API | http://localhost:4100 | REST + server-sent events, serves screenshots and reports |
| Kaamkaaj job board | http://localhost:4010 | The main app the operator drives. Log in with `aarav.sharma@example.test` / `demo-pass-2026` |
| Postbox webmail | http://localhost:4020 | The candidate's inbox, where confirmation emails arrive |
| Zentrail careers | http://localhost:4030 | An employer's own careers site with a different form layout |

The browser opens in a visible window by default so you can watch it work. Set `HEADLESS=true` in `.env` to hide it, and `SLOW_MO_MS` to slow it down or speed it up.

## Walkthrough (what the demo video shows)

Run `npm run setup` before each scenario to start from a clean state. The console also has a **Reset demo data** button.

### 1. The main task

Profile: Aarav Sharma. Click the first example goal and start the run.

- The shortlist appears for approval. Nimbus Health is left out because Aarav already applied there (it is in his tracker and on the board).
- Tiffinbox is applied to on Kaamkaaj (a two-step form).
- Zentrail's form is on its own careers site and asks Aarav to accept a 12-month bond. That is outside his authority, so the operator stops and asks. The bond field is outlined in the screenshot.
- If you skip it, the operator applies to Dhobi Express and then brings in the backup, Ledgerly. Ledgerly's form asks for a ₹499 assessment fee, so it asks again.
- At the end, verification checks each application on the board, in Postbox and in the tracker. The goal is marked met, or not met with a list of what is missing.

Open `workspace/trackers/aarav-sharma.xlsx` to see the new rows, or click **Open report**.

### 2. A variation, with no code change

Pick **Meera Iyer** and the second example goal (data analyst, remote or Pune, 12k+, best two). The operator runs a different search, meets different forms (including "Rate your SQL skill", answered from her profile) and writes to her own tracker.

Two other goals show other kinds of variation:

- *Apply to 5 React internships anywhere, skip Chaiwala Labs.* The goal asks for 5 but the limit is 3, so the operator asks whether to raise it.
- *Apply to the React Native internship in Bengaluru.* The form asks about relocating, which Aarav's profile leaves open, so the operator asks you instead of guessing.

### 3. Failures and recovery

Use the **Sandbox faults** panel on the home page or on a running run.

| Fault | What happens | What the operator does |
| --- | --- | --- |
| Next submit returns 502 | The site saves the application, but the browser gets an error page | Does not resubmit. Checks *My applications* (or the inbox for external sites), finds the application and records it. No duplicate. |
| Next submit hangs for 30s | Saved, but no response | Gives up waiting after 12s, then does the same check as above |
| Postbox is down + 502 on Zentrail | No way to prove the external application went through | Stops with a concrete blocker instead of risking a duplicate. The job stays "submitting", so **Resume run** checks again later. |
| Expire session soon | The board logs the operator out mid-application | Logs back in. If the lost request was the final submit, it confirms nothing was saved before trying once more. |
| Close the Dhobi Express posting | A planned job stops accepting applications | Marks it blocked with the reason and uses the next job on the shortlist |
| Kill the operator (Ctrl+C twice, or kill the API process) | Crash at any point, including between the click and the response | The run shows as *Interrupted*. **Resume run** carries on from the journal and checks any half-finished submit first. |

### 4. Human control

- **Pause** takes effect before the next browser action, not at the end of the job. **Continue** picks up exactly there.
- **Stop** submits nothing more, then still verifies and reports what was done.
- The limits on the home page are the operator's authority. Anything beyond them becomes a question: fees, contract terms, more applications than allowed, missing information. **Ask before every submit** shows the filled answers before each application.

## Command line

The same operator runs without the console:

```bash
npm run sandbox                     # in one terminal
npm run operator -- "Apply to 2 remote frontend internships paying 20k+" --profile workspace/profiles/aarav-sharma.json
npm run operator -- --list
npm run operator -- --resume <run-id>
```

While it runs, type `p` to pause, `r` to resume and `s` to stop. Ctrl+C once stops cleanly; twice quits immediately (use this to test resume). Options: `--max 3`, `--allow-fees`, `--allow-commitments`, `--no-confirm-plan`, `--confirm-submits`, `--headless`, and `--auto` (answers every question with the cautious choice, for unattended runs).

## Output

Each run gets a folder in `runs/<id>/`:

- `state.json`: the journal the operator resumes from
- `steps.jsonl`: every step, append-only
- `shots/`: numbered screenshots
- `report.html`: the evidence report (goal, verification table, what is not done, screenshots, every answer sent and where it came from, your decisions, timeline)

## Tests

```bash
npm test           # goal parsing, safety rules, shortlist filters, tracker idempotency, pause/stop/approvals
npm run typecheck
```

## Project layout

```
operator/          the operator itself (TypeScript, Node)
  runner.ts        one run: understand → search → shortlist → apply → verify → report
  apply.ts         one application, including the reconcile-before-retry logic
  answers.ts       what goes in each form field, with the safety rules first
  forms.ts         reads any HTML form by its labels and fills it
  goal.ts          plain English → mission (Groq model, with a rules fallback)
  matching.ts      deterministic shortlist with reasons
  verify.ts        independent check against board, inbox and tracker
  llm.ts           the only file that talks to Groq
  journal.ts       run state on disk, used for resume
  control.ts       pause, stop and approvals
  sites/           Kaamkaaj and Postbox navigation
  server.ts        HTTP API for the console
  cli.ts           terminal front end
console/           Next.js operator console
sandbox/           the test environment: job board, careers site, webmail, fault switches
workspace/         the candidate's files: profiles, resumes, tracker spreadsheets
tests/             unit tests (node:test)
```

## Troubleshooting

- **"Operator API offline" in the console**: `npm run dev` isn't running, or port 4100 is taken.
- **Browser doesn't open**: run `npx playwright install chromium`.
- **A run behaves oddly after many demos**: `npm run setup` resets the sandbox, resumes and trackers. Add `-- --runs` to delete old run folders too.
