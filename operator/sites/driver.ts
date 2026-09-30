import type { Page } from "playwright";
import type { StepLevel } from "../types.ts";

export interface Driver {
  page: Page;
  checkpoint(): Promise<void>;
  log(level: StepLevel, message: string, screenshotLabel?: string): Promise<string | null>;
}

export async function visibleText(page: Page) {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}
