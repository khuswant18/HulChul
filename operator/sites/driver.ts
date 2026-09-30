import type { Page } from "playwright";
import type { StepLevel } from "../types.ts";

// What a site adapter needs from the run: the tab to drive, a place to log,
// and the pause/stop checkpoint to call before acting.
export interface Driver {
  page: Page;
  checkpoint(): Promise<void>;
  log(level: StepLevel, message: string, screenshotLabel?: string): Promise<string | null>;
}

export async function visibleText(page: Page) {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}
