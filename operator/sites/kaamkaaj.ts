import type { JobListing } from "../types.ts";
import { visibleText, type Driver } from "./driver.ts";

// Navigation on the Kaamkaaj job board: logging in, searching, reading
// postings and the My applications page. Application forms are not handled
// here; they go through the generic form reader because every employer's
// form is different.

export interface SearchFilters {
  q: string;
  location: string;
  minStipend: number | null;
  postedWithinDays: number | null;
}

export interface BoardApplication {
  applicationId: string;
  boardId: number;
  role: string;
  company: string;
  appliedOn: string;
  status: string;
}

const STIPEND_OPTIONS = [5000, 10000, 15000, 20000, 30000];
const POSTED_OPTIONS = [1, 3, 7, 14, 30];

export class Kaamkaaj {
  constructor(
    private d: Driver,
    readonly baseUrl: string,
    private credentials: { email: string; password: string },
  ) {}

  get page() {
    return this.d.page;
  }

  isLoginPage() {
    return new URL(this.page.url()).pathname === "/login";
  }

  async open(target: string) {
    await this.d.checkpoint();
    const url = target.startsWith("http") ? target : this.baseUrl + target;
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
    await this.recoverSession();
  }

  // If the site bounced us to the login page, sign in again. The board sends
  // us back to the page we were trying to reach.
  async recoverSession() {
    if (!this.isLoginPage()) return false;
    const expired = (await visibleText(this.page)).includes("session has expired");
    if (expired) await this.d.log("warn", "Kaamkaaj session expired. Logging in again.", "session expired");
    await this.login();
    return true;
  }

  async login() {
    await this.d.checkpoint();
    if (!this.isLoginPage()) await this.page.goto(this.baseUrl + "/login", { waitUntil: "domcontentloaded" });
    await this.page.getByLabel("Email").fill(this.credentials.email);
    await this.page.getByLabel("Password").fill(this.credentials.password);
    await Promise.all([this.page.waitForLoadState("domcontentloaded"), this.page.getByRole("button", { name: "Log in" }).click()]);
    await this.page.waitForURL((url) => url.pathname !== "/login", { timeout: 8000 }).catch(() => null);
    if (this.isLoginPage()) {
      const alert = await this.page.locator("[role=alert]").first().innerText().catch(() => "unknown reason");
      throw new Error(`Could not log in to Kaamkaaj: ${alert}`);
    }
    await this.d.log("action", `Logged in to Kaamkaaj as ${this.credentials.email}`);
  }

  async search(filters: SearchFilters): Promise<string[]> {
    await this.open("/jobs");
    const form = this.page.getByRole("search");
    await form.getByLabel("Keywords").fill(filters.q);
    await form.getByLabel("Location").selectOption(filters.location);

    // The board only offers fixed steps, so pick the closest step that
    // doesn't hide anything the mission would accept. Exact values are
    // re-checked later when the shortlist is built.
    const stipendStep = filters.minStipend ? [...STIPEND_OPTIONS].reverse().find((s) => s <= filters.minStipend!) : undefined;
    await form.getByLabel("Minimum stipend").selectOption(stipendStep ? String(stipendStep) : "");
    const postedStep = filters.postedWithinDays ? POSTED_OPTIONS.find((d) => d >= filters.postedWithinDays!) : undefined;
    await form.getByLabel("Posted within").selectOption(postedStep ? String(postedStep) : "");

    await this.d.checkpoint();
    await Promise.all([this.page.waitForLoadState("domcontentloaded"), form.getByRole("button", { name: "Search" }).click()]);
    await this.recoverSession();

    const urls: string[] = [];
    for (let pageNo = 1; pageNo <= 10; pageNo++) {
      const count = await this.page.locator(".count").innerText().catch(() => "");
      await this.d.log("action", `Searched “${filters.q}”${filters.location ? ` in ${filters.location}` : ""}: ${count}, page ${pageNo}`, `search ${filters.q} page ${pageNo}`);
      const links = await this.page.locator("article.job-card h3 a").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
      urls.push(...links);
      const next = this.page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: /Next/ });
      if (!(await next.count())) break;
      await this.d.checkpoint();
      await Promise.all([this.page.waitForLoadState("domcontentloaded"), next.click()]);
      await this.recoverSession();
    }
    return urls;
  }

  async readJob(url: string): Promise<JobListing> {
    await this.open(url);
    const data = await this.page.evaluate(() => {
      const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      const facts: Record<string, string> = {};
      document.querySelectorAll("dl.facts > div").forEach((row) => {
        facts[text(row.querySelector("dt")).toLowerCase()] = text(row.querySelector("dd"));
      });
      const section = (heading: RegExp) => {
        const h2 = [...document.querySelectorAll("h2")].find((h) => heading.test(text(h)));
        return h2?.nextElementSibling ?? null;
      };
      const h1 = document.querySelector("h1");
      const externalLink = [...document.querySelectorAll("a")].find((a) => /apply on company site/i.test(text(a)));
      return {
        title: text(h1),
        company: text(h1?.nextElementSibling),
        facts,
        skills: [...document.querySelectorAll('ul[aria-label="Skills required"] li')].map((li) => text(li)),
        about: text(section(/^About/)),
        responsibilities: [...(section(/What you will do/)?.querySelectorAll("li") ?? [])].map((li) => text(li)),
        applied: text(document.querySelector(".notice.applied")),
        closed: Boolean(document.querySelector(".notice.closed")),
        draft: [...document.querySelectorAll("a")].some((a) => /continue application/i.test(text(a))),
        externalUrl: externalLink ? (externalLink as HTMLAnchorElement).href : null,
      };
    });

    const money = (data.facts.stipend ?? "").match(/[\d,]+/g)?.map((n) => Number(n.replace(/,/g, ""))) ?? [0];
    const date = (value: string | undefined) => {
      const parsed = new Date((value ?? "").replace("Sept", "Sep"));
      return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
    };
    const boardId = Number(new URL(url).pathname.split("/").pop());

    return {
      boardId,
      url,
      title: data.title,
      company: data.company,
      location: data.facts.location ?? "",
      mode: data.facts["work mode"] ?? "",
      stipendMin: Math.min(...money),
      stipendMax: Math.max(...money),
      postedOn: date(data.facts["posted on"]),
      deadline: date(data.facts["apply by"]),
      skills: data.skills,
      about: data.about,
      responsibilities: data.responsibilities,
      channel: data.externalUrl ? "external" : "kaamkaaj",
      applyUrl: data.externalUrl,
      state: data.applied ? "applied" : data.closed ? "closed" : data.draft ? "draft" : "open",
      existingApplicationId: data.applied.match(/KK-\d+/)?.[0] ?? null,
    };
  }

  async myApplications(): Promise<BoardApplication[]> {
    await this.open("/applications");
    return this.page.locator("table[aria-label='My applications'] tbody tr").evaluateAll((rows) =>
      rows.map((row) => {
        const cells = [...row.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim());
        const href = row.querySelector("a")?.getAttribute("href") ?? "";
        return {
          applicationId: cells[0],
          boardId: Number(href.split("/").pop()),
          role: cells[1],
          company: cells[2],
          appliedOn: cells[3],
          status: cells[4],
        };
      }),
    );
  }
}
