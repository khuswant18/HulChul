import "dotenv/config";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import express, { type Request, type Response } from "express";
import { Journal, RUNS_DIR } from "./journal.ts";
import { Llm } from "./llm.ts";
import { listProfiles, loadProfile } from "./profile.ts";
import { Run } from "./runner.ts";
import { readTracker } from "./tracker.ts";
import { defaultAuthority, type Authority, type RunState } from "./types.ts";

const port = Number(process.env.OPERATOR_PORT ?? 4100);
const boardUrl = process.env.KAAMKAAJ_URL ?? "http://localhost:4010";

const active = new Map<string, Run>();
const updates = new EventEmitter();
updates.setMaxListeners(100);

function track(run: Run) {
  active.set(run.state.id, run);
  run.journal.on("change", (state: RunState) => updates.emit("state", state));
  run.done().finally(() => {
    active.delete(run.state.id);
    updates.emit("state", run.state);
  });
  return run;
}

for (const state of Journal.list()) {
  if (["running", "paused", "waiting"].includes(state.status)) {
    const journal = new Journal(state);
    journal.update((s) => (s.status = "interrupted"));
  }
}

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use("/runs", express.static(RUNS_DIR));

const fail = (res: Response, status: number, message: string) => res.status(status).json({ error: message });

function stateOf(id: string) {
  return active.get(id)?.state ?? Journal.load(id);
}

app.get("/api/health", (_req, res) => {
  const llm = new Llm();
  res.json({ ok: true, llm: llm.mode, model: llm.enabled ? llm.model : null, activeRun: [...active.keys()][0] ?? null });
});

app.get("/api/profiles", (_req, res) => res.json(listProfiles()));

app.get("/api/tracker", async (req, res) => {
  try {
    const profile = loadProfile(String(req.query.profile));
    res.json({ path: profile.trackerPath, rows: await readTracker(profile.trackerPath) });
  } catch (error) {
    fail(res, 400, (error as Error).message);
  }
});

app.get("/api/runs", (_req, res) => {
  const runs = Journal.list().map((s) => stateOf(s.id)!);
  res.json(
    runs.map((s) => ({
      id: s.id,
      goal: s.goal,
      profileName: s.profileName,
      status: s.status,
      createdAt: s.createdAt,
      outcome: s.outcome,
      submitted: Object.values(s.applications).filter((a) => a.status === "submitted").length,
      target: s.target,
    })),
  );
});

app.post("/api/runs", (req, res) => {
  if (active.size) return fail(res, 409, "Another run is in progress. Stop it or wait for it to finish.");
  const { goal, profilePath, authority } = req.body as { goal?: string; profilePath?: string; authority?: Partial<Authority> };
  if (!goal?.trim()) return fail(res, 400, "Write a goal first.");
  if (!profilePath) return fail(res, 400, "Pick a profile.");
  try {
    const run = track(Run.start(goal, profilePath, { ...defaultAuthority, ...authority }));
    res.status(201).json({ id: run.state.id });
  } catch (error) {
    fail(res, 400, (error as Error).message);
  }
});

app.get("/api/runs/:id", (req, res) => {
  const state = stateOf(req.params.id);
  if (!state) return fail(res, 404, "No such run");
  res.json(state);
});

app.get("/api/runs/:id/events", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const initial = stateOf(id);
  if (!initial) return fail(res, 404, "No such run");

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (state: RunState) => res.write(`data: ${JSON.stringify(state)}\n\n`);
  send(initial);

  let pending: RunState | null = null;
  let timer: NodeJS.Timeout | null = null;
  const onState = (state: RunState) => {
    if (state.id !== id) return;
    pending = state;
    timer ??= setTimeout(() => {
      timer = null;
      if (pending) send(pending);
    }, 200);
  };
  updates.on("state", onState);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", () => {
    updates.off("state", onState);
    clearInterval(heartbeat);
    if (timer) clearTimeout(timer);
  });
});

function withActive(req: Request, res: Response, action: (run: Run) => void) {
  const run = active.get(String(req.params.id));
  if (!run) return fail(res, 409, "That run is not active.");
  action(run);
  res.json({ ok: true });
}

app.post("/api/runs/:id/pause", (req, res) => withActive(req, res, (run) => run.control.pause()));
app.post("/api/runs/:id/resume", (req, res) => withActive(req, res, (run) => run.control.resume()));
app.post("/api/runs/:id/stop", (req, res) => withActive(req, res, (run) => run.control.stop()));

app.post("/api/runs/:id/approvals/:approvalId", (req, res) => {
  const run = active.get(String(req.params.id));
  if (!run) return fail(res, 409, "That run is not active.");
  const { value, text } = req.body as { value: string; text?: string };
  if (!run.control.answer(String(req.params.approvalId), value, text)) {
    return fail(res, 409, "That question is no longer open.");
  }
  res.json({ ok: true });
});

app.post("/api/runs/:id/restart", (req, res) => {
  if (active.size) return fail(res, 409, "Another run is in progress.");
  try {
    const run = track(Run.resume(String(req.params.id)));
    res.json({ id: run.state.id });
  } catch (error) {
    fail(res, 400, (error as Error).message);
  }
});

app.get("/api/sandbox/faults", async (_req, res) => {
  try {
    res.json(await (await fetch(`${boardUrl}/__admin/faults`)).json());
  } catch {
    fail(res, 502, "Sandbox is not running. Start it with npm run sandbox.");
  }
});

app.post("/api/sandbox/faults", async (req, res) => {
  try {
    const r = await fetch(`${boardUrl}/__admin/faults`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req.body) });
    res.json(await r.json());
  } catch {
    fail(res, 502, "Sandbox is not running.");
  }
});

app.post("/api/sandbox/reset", (_req, res) => {
  if (active.size) return fail(res, 409, "Stop the active run before resetting the demo.");
  execFile("npx", ["tsx", "scripts/setup.ts"], (error, stdout) => {
    if (error) return fail(res, 500, error.message);
    res.json({ ok: true, log: stdout.trim() });
  });
});

app.listen(port, () => {
  const llm = new Llm();
  console.log(`Operator API       http://localhost:${port}  (reasoning: ${llm.enabled ? `Groq ${llm.model}` : "rules only, no GROQ_API_KEY"})`);
});
