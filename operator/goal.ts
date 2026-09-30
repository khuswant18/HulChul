import { z } from "zod";
import type { Llm } from "./llm.ts";
import type { Profile } from "./profile.ts";
import type { Mission } from "./types.ts";

// Turns the user's sentence into a Mission: the concrete, checkable
// constraints the rest of the operator works from. The model reads the goal
// when it is available; the rules below handle the same goals without it and
// also sanity-check whatever the model returns.

export const BOARD_LOCATIONS = ["Remote", "Bengaluru", "Pune", "Mumbai", "Hyderabad", "Gurugram"];

const MissionSchema = z.object({
  keywords: z.array(z.string()).describe("Short search terms for the job board, e.g. 'frontend', 'full stack', 'data analyst'"),
  locations: z.array(z.string()).describe("Allowed locations from the provided list. Empty means any location."),
  minStipend: z.number().nullable().describe("Minimum monthly stipend in INR, or null if not stated"),
  postedWithinDays: z.number().nullable().describe("Only jobs posted within this many days, or null"),
  maxApplications: z.number().nullable().describe("How many applications the user wants, or null if not stated"),
  excludeCompanies: z.array(z.string()),
  assumptions: z.array(z.string()).describe("Anything you had to assume or could not map, in plain words"),
});

const numberWords: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

type ParsedGoal = Omit<Mission, "summary" | "maxApplications"> & { maxApplications: number | null };

const toNumber = (word: string) => numberWords[word.toLowerCase()] ?? Number(word);

const roleTerms: [RegExp, string][] = [
  [/\bfront[\s-]?end\b/, "frontend"],
  [/\bfull[\s-]?stack\b/, "full stack"],
  [/\bback[\s-]?end\b/, "backend"],
  [/\breact native\b/, "react native"],
  [/\breact\b(?!\s+native)/, "react"],
  [/\bnode(\.js|js)?\b/, "node"],
  [/\bdata analy(st|sis|tics)\b/, "data analyst"],
  [/\bmachine learning\b|\bml\b/, "machine learning"],
  [/\b(product|ui|ux) design/, "design"],
  [/\bweb develop/, "web developer"],
  [/\bsoftware engineer/, "software engineering"],
];

const locationTerms: [RegExp, string][] = [
  [/\bremote\b|\bwork from home\b|\bwfh\b/, "Remote"],
  [/\bbengaluru\b|\bbangalore\b/, "Bengaluru"],
  [/\bpune\b/, "Pune"],
  [/\bmumbai\b|\bbombay\b/, "Mumbai"],
  [/\bhyderabad\b/, "Hyderabad"],
  [/\bgurugram\b|\bgurgaon\b/, "Gurugram"],
];

export function parseGoalWithRules(goal: string, profile: Profile): ParsedGoal {
  const text = goal.toLowerCase().replace(/\s+/g, " ");
  const assumptions: string[] = [];

  const keywords = [...new Set(roleTerms.filter(([re]) => re.test(text)).map(([, kw]) => kw))];
  // "react" on its own is redundant when a role like frontend is already there.
  const roleOnly = keywords.filter((k) => k !== "react" && k !== "node");
  const finalKeywords = roleOnly.length ? roleOnly : keywords;
  if (!finalKeywords.length) {
    finalKeywords.push(...profile.skills.slice(0, 2).map((s) => s.toLowerCase()));
    assumptions.push(`No role mentioned, so searching by your top skills (${finalKeywords.join(", ")}).`);
  }

  const anywhere = /\b(any ?where|any location)\b/.test(text);
  const locations = anywhere ? [] : locationTerms.filter(([re]) => re.test(text)).map(([, loc]) => loc);

  let maxApplications: number | null = null;
  const count =
    text.match(/\b(?:up to|at most|max(?:imum)?(?: of)?|best|top|only|apply to|apply for)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/) ??
    text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:applications|jobs|internships|roles|of them)\b/);
  if (count) maxApplications = toNumber(count[1]);
  // "apply to the React Native internship" talks about exactly one job.
  else if (/\b(?:the|an?)\s+(?:[\w.-]+\s+){0,4}(?:internship|job|role|opening)\b(?!s)/.test(text)) maxApplications = 1;

  let minStipend: number | null = null;
  for (const m of text.matchAll(/(₹|rs\.?\s?|inr\s?)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(k\b|000\b)?/g)) {
    const [, currency, digits, suffix] = m;
    let value = Number(digits.replace(/,/g, ""));
    if (suffix?.startsWith("k")) value *= 1000;
    const looksLikeMoney = Boolean(currency) || Boolean(suffix) || value >= 1000;
    const looksLikeYear = !currency && !suffix && value >= 1900 && value <= 2100;
    if (looksLikeMoney && !looksLikeYear) {
      minStipend = value;
      break;
    }
  }

  let postedWithinDays: number | null = null;
  const days = text.match(/\b(?:last|past)\s+(\d+|one|two|three|four|five|six|seven|ten|fourteen|thirty)\s+days?\b/);
  if (days) postedWithinDays = toNumber(days[1]) || { fourteen: 14, thirty: 30 }[days[1]] || null;
  else if (/\b(last|past|this) week\b/.test(text)) postedWithinDays = 7;
  else if (/\btoday\b|\blast 24 hours\b/.test(text)) postedWithinDays = 1;
  else if (/\b(last|past) (two weeks|fortnight)\b/.test(text)) postedWithinDays = 14;
  else if (/\b(this|last|past) month\b/.test(text)) postedWithinDays = 30;

  const excludeCompanies: string[] = [];
  for (const m of goal.matchAll(/\b(?:skip|exclude|except|avoid|not at|nothing from)\s+(?:anything |jobs |roles )?(?:from |at )?([A-Z][\w]*(?: [A-Z][\w]*)?)/g)) {
    excludeCompanies.push(m[1]);
  }

  return { keywords: finalKeywords, locations, minStipend, postedWithinDays, maxApplications, excludeCompanies, assumptions };
}

export function describeMission(m: Omit<Mission, "summary">) {
  const parts = [`Apply to up to ${m.maxApplications} ${m.keywords.join(" / ")} internship${m.maxApplications === 1 ? "" : "s"}`];
  parts.push(m.locations.length ? `in ${m.locations.join(" or ")}` : "in any location");
  if (m.minStipend) parts.push(`paying at least ₹${m.minStipend.toLocaleString("en-IN")}/month`);
  if (m.postedWithinDays) parts.push(`posted in the last ${m.postedWithinDays} day${m.postedWithinDays === 1 ? "" : "s"}`);
  if (m.excludeCompanies.length) parts.push(`excluding ${m.excludeCompanies.join(", ")}`);
  return parts.join(", ") + ", then log each one in the tracker.";
}

export async function parseGoal(goal: string, profile: Profile, llm: Llm): Promise<{ mission: Mission; via: "groq" | "rules" }> {
  const rules = parseGoalWithRules(goal, profile);
  let parsed: ParsedGoal = rules;
  let via: "groq" | "rules" = "rules";

  const fromModel = await llm.json(MissionSchema, {
    purpose: "Reading the goal",
    system:
      "You turn a job seeker's instruction into search constraints for an internship board. " +
      "Only use information stated or clearly implied in the instruction. Do not invent constraints. " +
      "Map place names to the allowed location list; 'work from home' means Remote. " +
      "Stipends are monthly INR amounts; '15k' means 15000. " +
      "Keywords should be short role terms that would appear in a job title.",
    prompt: `Allowed locations: ${BOARD_LOCATIONS.join(", ")}\nToday: ${new Date().toISOString().slice(0, 10)}\n\nInstruction:\n${goal}`,
  });

  if (fromModel) {
    via = "groq";
    parsed = {
      ...fromModel,
      keywords: fromModel.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean),
      locations: fromModel.locations.filter((l) => BOARD_LOCATIONS.includes(l)),
    };
    if (!parsed.keywords.length) parsed.keywords = rules.keywords;
  }

  const assumptions = [...parsed.assumptions];
  let maxApplications = parsed.maxApplications;
  if (!maxApplications || maxApplications < 1) {
    maxApplications = 3;
    assumptions.push("The goal did not say how many, so the operator will aim for 3 applications.");
  }
  maxApplications = Math.min(Math.round(maxApplications), 20);

  const mission = { ...parsed, maxApplications, assumptions };
  return { mission: { ...mission, summary: describeMission(mission) }, via };
}
