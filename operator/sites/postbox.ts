import { visibleText, type Driver } from "./driver.ts";

export interface InboxMail {
  id: number;
  from: string;
  subject: string;
  sentAt: string;
}

export class MailboxUnavailable extends Error {}

export class Postbox {
  constructor(
    private d: Driver,
    private baseUrl: string,
    private credentials: { email: string; password: string },
  ) {}

  private async goto(path: string) {
    await this.d.checkpoint();
    const response = await this.d.page.goto(this.baseUrl + path, { waitUntil: "domcontentloaded" }).catch((err: Error) => {
      throw new MailboxUnavailable(`Postbox did not load: ${err.message.split("\n")[0]}`);
    });
    if (response && response.status() >= 500) {
      throw new MailboxUnavailable(`Postbox returned HTTP ${response.status()}`);
    }
    if (new URL(this.d.page.url()).pathname === "/login") {
      await this.d.page.getByLabel("Email").fill(this.credentials.email);
      await this.d.page.getByLabel("Password").fill(this.credentials.password);
      await Promise.all([this.d.page.waitForLoadState("domcontentloaded"), this.d.page.getByRole("button", { name: "Sign in" }).click()]);
      if (path !== "/") await this.d.page.goto(this.baseUrl + path, { waitUntil: "domcontentloaded" });
    }
  }

  async inbox(): Promise<InboxMail[]> {
    await this.goto("/");
    return this.d.page.locator("table[aria-label=Inbox] tr").evaluateAll((rows) =>
      rows.map((row) => ({
        id: Number(row.getAttribute("data-mail-id")),
        from: (row.querySelector(".from")?.textContent ?? "").trim(),
        subject: (row.querySelector(".subject")?.textContent ?? "").trim(),
        sentAt: (row.querySelector(".date")?.textContent ?? "").trim(),
      })),
    );
  }

  async read(id: number) {
    await this.goto(`/messages/${id}`);
    return visibleText(this.d.page);
  }
}
