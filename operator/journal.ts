import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import type { Phase, RunState, Step, StepLevel } from "./types.ts";

export const RUNS_DIR = path.resolve("runs");

export class Journal extends EventEmitter {
  readonly dir: string;
  readonly shotsDir: string;
  private stepsFile: string;
  private stateFile: string;

  constructor(public state: RunState) {
    super();
    this.dir = path.join(RUNS_DIR, state.id);
    this.shotsDir = path.join(this.dir, "shots");
    this.stepsFile = path.join(this.dir, "steps.jsonl");
    this.stateFile = path.join(this.dir, "state.json");
    fs.mkdirSync(this.shotsDir, { recursive: true });
    this.persist();
  }

  static load(id: string): RunState | null {
    const file = path.join(RUNS_DIR, id, "state.json");
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as RunState;
  }

  static list(): RunState[] {
    if (!fs.existsSync(RUNS_DIR)) return [];
    return fs
      .readdirSync(RUNS_DIR)
      .map((id) => Journal.load(id))
      .filter((s): s is RunState => s !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  update(change: (state: RunState) => void) {
    change(this.state);
    this.state.updatedAt = new Date().toISOString();
    this.persist();
    this.emit("change", this.state);
  }

  step(phase: Phase, level: StepLevel, message: string, screenshot: string | null = null) {
    const step: Step = { n: this.state.steps.length + 1, at: new Date().toISOString(), phase, level, message, screenshot };
    fs.appendFileSync(this.stepsFile, JSON.stringify(step) + "\n");
    this.update((s) => {
      s.steps.push(step);
      if (screenshot) s.latestScreenshot = screenshot;
    });
    return step;
  }

  private persist() {
    const tmp = this.stateFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.stateFile);
  }
}
