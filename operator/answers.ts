import { z } from "zod";
import type { Llm } from "./llm.ts";
import { hasSkill, type Profile } from "./profile.ts";
import type { Authority, JobListing } from "./types.ts";
import { writeAnswer } from "./writer.ts";

export interface FormField {
  name: string;
  kind: "text" | "email" | "tel" | "url" | "number" | "date" | "textarea" | "select" | "radio" | "checkbox" | "file";
  label: string;
  required: boolean;
  options: string[];
}

export type FieldPlan =
  | { field: FormField; action: "fill"; value: string; source: string }
  | { field: FormField; action: "leave"; reason: string }
  | { field: FormField; action: "ask"; kind: "fee" | "commitment" | "input"; reason: string };

const agreeKinds = new Set<FormField["kind"]>(["checkbox", "radio", "select"]);

export function safetyCheck(field: FormField, authority: Authority): FieldPlan | null {
  const label = field.label.toLowerCase();

  if (/aa?dh?aa?r|\bpan\b|passport|bank account|ifsc|date of birth|\bdob\b/.test(label)) {
    return { field, action: "ask", kind: "input", reason: "Asks for a government ID, bank or birth detail. The operator never shares these on its own." };
  }
  if (!agreeKinds.has(field.kind)) return null;

  if (/\bbond\b|service agreement|exit clause|lock-?in|non-?compete|penalty/.test(label)) {
    if (authority.allowCommitments) return { field, action: "fill", value: "yes", source: "accepted: you allowed contract terms" };
    return { field, action: "ask", kind: "commitment", reason: "Agreeing would bind you to a contract term. You have not allowed the operator to accept commitments." };
  }
  if (/\bfee\b|payment|\bpay\b|deposit|₹\s?\d|rs\.?\s?\d/.test(label)) {
    if (authority.allowFees) return { field, action: "fill", value: "yes", source: "accepted: you allowed fees" };
    return { field, action: "ask", kind: "fee", reason: "Agreeing would mean paying money. You have not allowed the operator to spend money." };
  }
  return null;
}

function profileAnswer(field: FormField, profile: Profile): FieldPlan | null {
  const label = field.label.toLowerCase();
  const fill = (value: string | number, source: string): FieldPlan => ({ field, action: "fill", value: String(value), source });

  if (field.kind === "file") {
    return /resume|cv/.test(label) ? fill(profile.resumePath, "resume file") : null;
  }
  if (field.kind === "checkbox" && /(information|details|above).*(accurate|true|correct)/.test(label)) {
    return fill("yes", "standard accuracy declaration");
  }
  if (/full ?name|^name$|your name/.test(label)) return fill(profile.name, "profile.name");
  if (field.kind === "email" || /e-?mail/.test(label)) return fill(profile.email, "profile.email");
  if (field.kind === "tel" || /phone|mobile/.test(label)) return fill(profile.phone, "profile.phone");
  if (/github|portfolio/.test(label)) {
    const link = profile.links.github ?? profile.links.portfolio;
    return link ? fill(link, "profile.links") : null;
  }
  if (/linkedin/.test(label) && profile.links.linkedin) return fill(profile.links.linkedin, "profile.links");
  if (/hours/.test(label)) return fill(profile.availability.hoursPerWeek, "profile.availability");
  if (/start date|available from|availability date|joining date|when can you (start|join)/.test(label)) {
    return fill(profile.availability.startDate, "profile.availability");
  }
  if (/notice period/.test(label)) return fill(profile.availability.noticePeriod, "profile.availability");
  if (/expected .*(stipend|salary|ctc|pay)/.test(label)) return fill(profile.preferences.expectedStipend, "profile.preferences");
  if (/current (city|location)|where .*(based|live)/.test(label)) return fill(profile.city, "profile.city");

  if (/relocat/.test(label)) {
    const choice = profile.preferences.willingToRelocate;
    if (choice === null) return null;
    return fill(choice ? "Yes" : "No", "profile.preferences");
  }

  const rate = label.match(/rate your ([\w .+#-]+?) skill|rate your ([\w .+#-]+)/);
  if (rate && field.kind === "select") {
    const skill = (rate[1] ?? rate[2]).trim();
    const entry = Object.entries(profile.skillLevels).find(([k]) => k.toLowerCase() === skill);
    const option = entry && field.options.find((o) => o.trim().startsWith(String(entry[1])));
    return option ? fill(option, `profile.skillLevels.${entry[0]}`) : null;
  }

  const skillQuestion = label.match(/(?:comfortable (?:working )?with|experience (?:with|in)|do you know|have you used) ([\w .+#-]+?)\??$/);
  if (skillQuestion && (field.kind === "radio" || field.kind === "select")) {
    const knows = hasSkill(profile, skillQuestion[1]);
    const option = field.options.find((o) => o.toLowerCase() === (knows ? "yes" : "no"));
    return option ? fill(option, "profile.skills") : null;
  }
  return null;
}

const isFreeText = (field: FormField) =>
  field.kind === "textarea" ||
  /cover (note|letter)|why do you|what would you like|tell us|describe|motivation/.test(field.label.toLowerCase());

const MappedSchema = z.object({
  answers: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      evidence: z.string().describe("The exact text from the profile that supports this value, or an empty string"),
    }),
  ),
});

async function askModelForUnknownFields(fields: FormField[], profile: Profile, llm: Llm) {
  if (!fields.length || !llm.enabled) return new Map<string, { value: string; evidence: string }>();
  const profileText = JSON.stringify(profile);
  const result = await llm.json(MappedSchema, {
    purpose: "Matching form fields to the profile",
    system:
      "You fill job application fields from a candidate profile. For each field, answer only if the profile contains the answer. " +
      "Put the supporting profile text in evidence, copied exactly. If the profile does not contain it, return an empty value and empty evidence. " +
      "For select and radio fields, the value must be one of the options exactly.",
    prompt: `Fields:\n${JSON.stringify(fields, null, 2)}\n\nProfile:\n${JSON.stringify(profile, null, 2)}`,
  });

  const accepted = new Map<string, { value: string; evidence: string }>();
  for (const answer of result?.answers ?? []) {
    const field = fields.find((f) => f.name === answer.name);
    if (!field || !answer.value.trim() || !answer.evidence.trim()) continue;
    if (!profileText.includes(answer.evidence.trim())) continue;
    if (field.options.length && !field.options.includes(answer.value)) continue;
    accepted.set(field.name, { value: answer.value, evidence: answer.evidence });
  }
  return accepted;
}

export async function planAnswers(
  fields: FormField[],
  ctx: { profile: Profile; job: JobListing; authority: Authority; llm: Llm; remembered: Map<string, string> },
): Promise<FieldPlan[]> {
  const plans: (FieldPlan | null)[] = [];
  const unknown: FormField[] = [];

  for (const field of fields) {
    const remembered = ctx.remembered.get(field.label.toLowerCase());
    const safety = safetyCheck(field, ctx.authority);
    if (safety) {
      const reuse = remembered && safety.action === "ask";
      plans.push(reuse ? { field, action: "fill", value: remembered, source: "your answer earlier in this run" } : safety);
      continue;
    }
    const fromProfile = profileAnswer(field, ctx.profile);
    if (fromProfile) {
      plans.push(fromProfile);
      continue;
    }
    if (remembered) {
      plans.push({ field, action: "fill", value: remembered, source: "your answer earlier in this run" });
      continue;
    }
    if (isFreeText(field)) {
      const { text, source } = await writeAnswer(field.label, ctx.profile, ctx.job, ctx.llm);
      plans.push({ field, action: "fill", value: text, source });
      continue;
    }
    plans.push(null);
    unknown.push(field);
  }

  const mapped = await askModelForUnknownFields(unknown, ctx.profile, ctx.llm);
  return fields.map((field, i) => {
    const plan = plans[i];
    if (plan) return plan;
    const guess = mapped.get(field.name);
    if (guess) return { field, action: "fill", value: guess.value, source: `profile (Groq, quoted "${guess.evidence.slice(0, 40)}")` };
    if (field.required) {
      return { field, action: "ask", kind: "input", reason: "Your profile doesn't answer this and the form requires it." };
    }
    return { field, action: "leave", reason: "Optional and not in your profile" };
  });
}
