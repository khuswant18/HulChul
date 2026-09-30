import path from "node:path";
import type { Page } from "playwright";
import type { FieldPlan, FormField } from "./answers.ts";

export async function readForm(page: Page): Promise<{ fields: FormField[]; submitLabel: string } | null> {
  return page.evaluate(() => {
    const clean = (text: string | null | undefined) =>
      (text ?? "").replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim();

    const forms = [...document.querySelectorAll("form")].filter(
      (f) => f.getAttribute("role") !== "search" && f.querySelector("input:not([type=hidden]), textarea, select"),
    );
    if (!forms.length) return null;

    const form = forms.sort((a, b) => b.elements.length - a.elements.length)[0];

    const labelFor = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
      const labelled = el.labels?.[0];
      if (labelled) {
        const copy = labelled.cloneNode(true) as HTMLElement;
        copy.querySelectorAll("input, select, textarea, .field-error, div").forEach((n) => n.remove());
        const text = clean(copy.textContent);
        if (text) return text;
      }
      return clean(el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title") || el.name);
    };

    const fields: {
      name: string;
      kind: string;
      label: string;
      required: boolean;
      options: string[];
    }[] = [];
    const seenRadio = new Set<string>();

    for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
      const type = el instanceof HTMLInputElement ? el.type : el instanceof HTMLSelectElement ? "select" : "textarea";
      if (["hidden", "submit", "button", "reset"].includes(type) || !el.name) continue;

      if (type === "radio") {
        if (seenRadio.has(el.name)) continue;
        seenRadio.add(el.name);
        const group = [...form.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${el.name}"]`)];
        const legend = el.closest("fieldset")?.querySelector("legend");
        const legendText = legend ? clean([...legend.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ")) : "";
        fields.push({
          name: el.name,
          kind: "radio",
          label: legendText || clean(legend?.textContent) || el.name,
          required: group.some((r) => r.required),
          options: group.map((r) => r.value),
        });
        continue;
      }

      fields.push({
        name: el.name,
        kind: ["text", "email", "tel", "url", "number", "date", "checkbox", "file"].includes(type) ? type : type === "select" ? "select" : type === "textarea" ? "textarea" : "text",
        label: labelFor(el),
        required: el.required,
        options: el instanceof HTMLSelectElement ? [...el.options].filter((o) => o.value !== "").map((o) => o.text.trim()) : [],
      });
    }

    const submit = form.querySelector<HTMLButtonElement | HTMLInputElement>("button[type=submit], button:not([type]), input[type=submit]");
    return { fields, submitLabel: clean(submit?.textContent || (submit as HTMLInputElement | null)?.value || "Submit") };
  }) as Promise<{ fields: FormField[]; submitLabel: string } | null>;
}

export async function fillField(page: Page, plan: Extract<FieldPlan, { action: "fill" }>) {
  const { field, value } = plan;
  const target = page.locator(`form [name="${field.name}"]`);

  switch (field.kind) {
    case "file":
      await target.first().setInputFiles(path.resolve(value));
      break;
    case "checkbox":
      if (/^(yes|true|on|checked|accepted)$/i.test(value)) await target.first().check();
      else await target.first().uncheck();
      break;
    case "radio":
      await page.locator(`form input[type=radio][name="${field.name}"][value="${value}"]`).check();
      break;
    case "select":
      await target.first().selectOption({ label: value });
      break;
    default:
      await target.first().fill(value);
  }
}

export const isFinalStep = (submitLabel: string) => !/\b(next|continue|save and|proceed)\b/i.test(submitLabel);

export async function clickSubmit(page: Page) {
  const form = page.locator("form:not([role=search])").filter({ has: page.locator("input:not([type=hidden]), textarea, select") });
  const button = form.last().locator("button[type=submit], button:not([type]), input[type=submit]").last();
  const [response] = await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 12_000 }).catch(() => null),
    button.click({ noWaitAfter: true }),
  ]);
  return response;
}

export async function pageErrors(page: Page) {
  const texts = await page.locator("[role=alert], .field-error, .errors, .err").allInnerTexts();
  return [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
}

export async function highlightField(page: Page, fieldName: string) {
  await page
    .locator(`form [name="${fieldName}"]`)
    .first()
    .evaluate((el) => {
      const box = (el.closest("label, fieldset, .field") ?? el) as HTMLElement;
      box.style.outline = "3px solid #e0a100";
      box.style.outlineOffset = "4px";
      box.scrollIntoView({ block: "center" });
    })
    .catch(() => null);
}
