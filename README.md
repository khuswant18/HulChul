# Career Operator

Tell it a job-hunting goal in plain English, for example:

> Apply to up to 3 remote frontend or full-stack internships posted in the last week that pay at least ₹15,000 a month.

It opens a real browser, finds matching jobs on a job board, fills and submits the applications, adds each one to an Excel tracker, and then checks that everything really went through. It asks you first before paying a fee, accepting a contract, or answering something it doesn't know.

Everything runs on your own computer against small practice websites that come with the project. All people, companies and jobs are made up.

---

## Quick start

You need **Node.js 20 or newer** ([download](https://nodejs.org)). Check with `node -v`.

Run these commands one by one in a terminal:

```bash
git clone https://github.com/khuswant18/HulChul.git
cd HulChul
npm install
npx playwright install chromium
cp .env.example .env
npm run setup
npm run dev
```

On Windows (Command Prompt), use `copy .env.example .env` instead of `cp`.

When the terminal shows `Ready`, open **http://localhost:3000** in your browser. That's it.

- `npm run setup` prepares the demo data. Run it again any time you want a fresh start.
- `npm run dev` starts everything. Keep this terminal open. Press `Ctrl+C` to stop.
- The first page load can take a few seconds while Next.js compiles.

### Optional: AI with Groq

It works fully without any API key, using built-in rules. For smarter goal reading and better-written cover notes, add a free Groq key:

1. Get a key at https://console.groq.com/keys
2. Open the `.env` file and paste it after `GROQ_API_KEY=`
3. Stop `npm run dev` (`Ctrl+C`) and start it again

The top-right corner of the console shows **Reasoning: Groq** when the key is being used.

---

## What starts on your computer

| Open this | What it is |
| --- | --- |
| http://localhost:3000 | **Operator console.** Start runs, watch progress, approve, pause, stop. |
| http://localhost:4010 | **Kaamkaaj**, a practice job board. The operator applies to jobs here. |
| http://localhost:4020 | **Postbox**, a practice email inbox. Confirmation emails arrive here. |
| http://localhost:4030 | **Zentrail**, a company's own careers site with a different form. |

Kaamkaaj and Postbox show demo accounts on their login pages with a **Use this account** button, so you don't need to remember anything:

| Name | Email | Password |
| --- | --- | --- |
| Aarav Sharma | `aarav.sharma@example.test` | `demo-pass-2026` |
| Meera Iyer | `meera.iyer@example.test` | `demo-pass-2026` |

---

## Try it in 2 minutes

1. Open http://localhost:3000.
2. Under **Try one of these**, click the first goal. **Applying as** is set to Aarav Sharma.
3. Click **Start run**.
4. A Chromium window opens and you can watch it work. The console shows every step.
5. When the shortlist appears, click **Approve plan**.
6. When it asks about a bond or a fee, choose **Skip this job** or **I agree**.
7. At the end, look at the **Verification** table and click **Open report**.

The new applications are also in `workspace/trackers/aarav-sharma.xlsx`, on Kaamkaaj under *My applications*, and as emails in Postbox.

---

## Demo scenarios

Run `npm run setup` (or click **Reset demo data** in the console) before each one.

### 1. Main task

Aarav, first example goal.

- It skips Nimbus Health because Aarav already applied there. That job is already in his tracker.
- It applies to Tiffinbox on Kaamkaaj through a two-step form.
- Zentrail's form asks him to accept a 12-month bond. That's outside what you allowed, so it stops and asks you.
- Ledgerly's form asks for a ₹499 fee, so it asks again.
- Finally it checks every application against the job board, the inbox and the Excel file.

### 2. Different goal, no code change

Pick **Meera Iyer** and the second example goal (data analyst, remote or Pune, 12k+). It runs a different search, meets different forms, and writes to Meera's own tracker.

Two more:

- *Apply to 5 React internships anywhere, skip Chaiwala Labs.* It asks whether to go above your limit of 3.
- *Apply to the React Native internship in Bengaluru.* It asks whether Aarav will relocate, because his profile doesn't say.

### 3. Break things on purpose

Use the **Sandbox faults** panel on the console home page, then start a run.

| Switch | What goes wrong | What the operator does |
| --- | --- | --- |
| Next submit returns 502 | The site saves the application but shows an error | Checks *My applications* (or the inbox), finds it, and does **not** apply twice |
| Next submit hangs for 30s | No answer from the site | Stops waiting after 12s, then checks the same way |
| Postbox is down | Can't read confirmation emails | If it can't prove an application went through, it stops and explains instead of guessing |
| Expire session soon | Logged out mid-application | Logs back in and continues |
| Close the Dhobi Express posting | A planned job closes | Marks it blocked and uses the next job on the list |

**Crash test:** while a run is going, press `Ctrl+C` in the terminal, then run `npm run dev` again. Open the run. It shows **Interrupted**. Click **Resume run** and it continues where it stopped, without duplicates.

### 4. You stay in control

- **Pause / Continue**: it stops before its next click.
- **Stop**: it submits nothing more, then still checks and reports what was done.
- The checkboxes under **What the operator may do without asking** are its limits. Anything beyond them becomes a question for you.

---

## Settings (`.env`)

You normally only touch the first line.

| Setting | Default | What it does |
| --- | --- | --- |
| `GROQ_API_KEY` | empty | Your Groq key. Empty means rules-only mode. |
| `OPERATOR_MODEL` | `openai/gpt-oss-120b` | Groq model. `openai/gpt-oss-20b` also works. |
| `HEADLESS` | `false` | `true` hides the browser window. |
| `SLOW_MO_MS` | `120` | Delay between browser actions. Use `300` to make it easier to follow. |
| `SANDBOX_PASSWORD` | `demo-pass-2026` | Password of the demo accounts. |

---

## Run from the terminal (optional)

The console is the easiest way. The same operator also works from the terminal:

```bash
npm run sandbox
```

Then, in a second terminal:

```bash
npm run operator -- "Apply to 2 remote frontend internships paying 20k+"
```

- Type `p` to pause, `r` to resume, `s` to stop.
- Use `--profile workspace/profiles/meera-iyer.json` for Meera.
- `npm run operator -- --list` shows past runs.
- `npm run operator -- --resume <run-id>` continues one.

---

## Where the results go

Each run gets a folder `runs/<run-id>/`:

- `report.html`: the evidence report. Open it in a browser.
- `shots/`: screenshots of every step.
- `state.json`: saved progress, used to resume after a crash.

The Excel trackers are in `workspace/trackers/`.

---

## Tests

```bash
npm test
npm run typecheck
```

---

## Project layout

```
console/     the web console (Next.js + React)
operator/    the operator: browser control, form filling, safety rules, verification
sandbox/     the practice websites: Kaamkaaj, Zentrail, Postbox
workspace/   the candidates' files: profiles, resumes, Excel trackers
scripts/     demo data setup
tests/       unit tests
```

How it works and why it's built this way: see [ENGINEERING_NOTE.md](ENGINEERING_NOTE.md).

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Console says **Operator API offline** | `npm run dev` isn't running. Start it and refresh the page. |
| `Executable doesn't exist` or no browser opens | Run `npx playwright install chromium` |
| `Port 3000 (or 4010, 4020, 4030, 4100) is in use` | Close the other program using it, or stop an old `npm run dev` |
| A run fails with `ERR_CONNECTION_REFUSED` | The practice sites aren't running. Start everything with `npm run dev`, not only the console. |
| Red "hydration" warning in the browser | Caused by a browser extension. Use an Incognito window. |
| Things look strange after many runs | `npm run setup -- --runs` resets everything and deletes old runs |
