import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface BrowserOptions {
  headless: boolean;
  slowMo: number;
}

export function browserOptionsFromEnv(): BrowserOptions {
  return {
    headless: process.env.HEADLESS === "true" || process.env.HEADLESS === "1",
    slowMo: Number(process.env.SLOW_MO_MS ?? 120),
  };
}

// One Chromium window per run. Screenshots are named by a running counter so
// the evidence folder reads in order.
export class OperatorBrowser {
  private browser: Browser | null = null;
  private counter = 0;

  constructor(
    private shotsDir: string,
    private options: BrowserOptions,
  ) {}

  async launch() {
    this.browser = await chromium.launch({ headless: this.options.headless, slowMo: this.options.slowMo });
    return this;
  }

  async newPage(): Promise<{ context: BrowserContext; page: Page }> {
    if (!this.browser) throw new Error("Browser not launched");
    const context = await this.browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "en-IN" });
    context.setDefaultTimeout(15_000);
    // tsx keeps function names by wrapping them in __name(), and that helper
    // doesn't exist inside the page when a function is sent to page.evaluate.
    await context.addInitScript({ content: "globalThis.__name = (fn) => fn;" });
    const page = await context.newPage();
    return { context, page };
  }

  async screenshot(page: Page, label: string) {
    this.counter += 1;
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
    const file = `${String(this.counter).padStart(3, "0")}-${slug}.jpg`;
    await page.screenshot({ path: path.join(this.shotsDir, file), type: "jpeg", quality: 70, fullPage: true }).catch(() => null);
    return `shots/${file}`;
  }

  // Continue numbering after a resume instead of overwriting old evidence.
  startCounterAt(n: number) {
    this.counter = n;
  }

  async close() {
    await this.browser?.close().catch(() => null);
    this.browser = null;
  }
}
