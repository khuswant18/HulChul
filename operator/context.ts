import type { Page } from "playwright";
import type { OperatorBrowser } from "./browser.ts";
import type { RunControl } from "./control.ts";
import type { Journal } from "./journal.ts";
import type { Llm } from "./llm.ts";
import type { Profile } from "./profile.ts";
import type { Driver } from "./sites/driver.ts";
import type { Kaamkaaj } from "./sites/kaamkaaj.ts";
import type { RunState, StepLevel } from "./types.ts";

export interface SandboxUrls {
  kaamkaaj: string;
  postbox: string;
}

export function sandboxUrlsFromEnv(): SandboxUrls {
  return {
    kaamkaaj: process.env.KAAMKAAJ_URL ?? "http://localhost:4010",
    postbox: process.env.POSTBOX_URL ?? "http://localhost:4020",
  };
}

// Everything one run needs, passed around instead of globals.
export interface RunContext {
  journal: Journal;
  control: RunControl;
  browser: OperatorBrowser;
  page: Page;
  driver: Driver;
  board: Kaamkaaj;
  profile: Profile;
  llm: Llm;
  urls: SandboxUrls;
  credentials: { email: string; password: string };
  // Answers the user gave earlier in this run, keyed by question text.
  remembered: Map<string, string>;
  readonly state: RunState;
  log(level: StepLevel, message: string, screenshotLabel?: string, page?: Page): Promise<string | null>;
}
