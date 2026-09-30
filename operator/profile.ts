import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const ProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  city: z.string(),
  education: z.string(),
  headline: z.string(),
  links: z.object({ github: z.string().optional(), portfolio: z.string().optional(), linkedin: z.string().optional() }),
  skills: z.array(z.string()),

  skillLevels: z.record(z.string(), z.number().min(1).max(5)).default({}),
  projects: z.array(z.object({ name: z.string(), summary: z.string(), skills: z.array(z.string()) })),
  availability: z.object({ hoursPerWeek: z.number(), startDate: z.string(), noticePeriod: z.string() }),
  preferences: z.object({
    expectedStipend: z.number(),

    willingToRelocate: z.boolean().nullable(),
  }),
  resumePath: z.string(),
  trackerPath: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export function loadProfile(file: string): Profile {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const profile = ProfileSchema.parse(raw);
  const resume = path.resolve(profile.resumePath);
  if (!fs.existsSync(resume)) {
    throw new Error(`Resume not found at ${profile.resumePath}. Run "npm run setup" first.`);
  }
  return profile;
}

export function listProfiles(dir = "workspace/profiles") {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const file = path.join(dir, f);
      const profile = ProfileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
      return { file, name: profile.name, headline: profile.headline };
    });
}

const aliases: Record<string, string[]> = {
  "node.js": ["node", "nodejs"],
  "next.js": ["next", "nextjs"],
  "react": ["reactjs", "react.js"],
  "javascript": ["js"],
  "typescript": ["ts"],
  "tailwind css": ["tailwind"],
  "rest apis": ["rest", "rest api"],
  "power bi": ["powerbi"],
  "machine learning": ["ml"],
};

export function canonicalSkill(skill: string) {
  const s = skill.trim().toLowerCase();
  for (const [canonical, alts] of Object.entries(aliases)) {
    if (s === canonical || alts.includes(s)) return canonical;
  }
  return s;
}

export function hasSkill(profile: Profile, skill: string) {
  const wanted = canonicalSkill(skill);
  return profile.skills.some((s) => canonicalSkill(s) === wanted);
}
