import { z } from "zod";
import type { Llm } from "./llm.ts";
import { canonicalSkill, type Profile } from "./profile.ts";
import type { JobListing } from "./types.ts";

const AnswerSchema = z.object({ answer: z.string() });

function bestProject(profile: Profile, job: JobListing) {
  const wanted = new Set(job.skills.map(canonicalSkill));
  return [...profile.projects].sort(
    (a, b) =>
      b.skills.filter((s) => wanted.has(canonicalSkill(s))).length -
      a.skills.filter((s) => wanted.has(canonicalSkill(s))).length,
  )[0];
}

function listJoin(items: string[]) {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function templateAnswer(question: string, profile: Profile, job: JobListing) {
  const first = profile.name.split(" ")[0];
  const project = bestProject(profile, job);
  const mine = new Set(profile.skills.map(canonicalSkill));
  const matched = job.skills.filter((s) => mine.has(canonicalSkill(s)));
  const skills = listJoin(matched.length ? matched : profile.skills.slice(0, 3));
  const availability = `I can give ${profile.availability.hoursPerWeek} hours a week from ${formatDate(profile.availability.startDate)}.`;
  const q = question.toLowerCase();

  if (/describe|tell us about|a project|you have built/.test(q)) {
    return `The closest thing I have built is ${project.name}: ${project.summary}. I worked with ${listJoin(project.skills)} on it, handled the data model and the API myself, and fixed issues that real users reported. I'm happy to walk through the code.`;
  }
  if (/why|motivat|interest/.test(q)) {
    return `${job.about.split(". ")[0].replace(/\.$/, "")}. That is the kind of product I want to work on: something people depend on every day. The role also uses the tools I know best, ${skills}. My most relevant work is ${project.name}, ${project.summary}. ${availability}`;
  }
  if (/what would you like to build|what do you want to work on/.test(q)) {
    const task = job.responsibilities[0]?.toLowerCase() ?? `the ${job.title.toLowerCase()} work`;
    return `I'd like to ${task.replace(/^build /, "build ")}. It is close to what I did in ${project.name}, ${project.summary}. I'd also like to learn how a team ships and supports a product at your scale. ${availability}`;
  }
  return `Hi ${job.company} team, I'm ${first}, a ${lowerFirst(profile.headline)}. I mostly build with ${skills}. My best project is ${project.name}, ${project.summary}. I'd like to bring that experience to the ${job.title} role. ${availability} Thank you for considering my application.`;
}

export async function writeAnswer(question: string, profile: Profile, job: JobListing, llm: Llm) {
  const fallback = templateAnswer(question, profile, job);
  const result = await llm.json(AnswerSchema, {
    purpose: "Writing an answer",
    system:
      "You write short answers for an internship application on the candidate's behalf, in first person. " +
      "Use only facts from the candidate profile and the job posting. Never invent experience, numbers or employers. " +
      "Be specific and plain: 60 to 110 words, no greeting lines, no buzzwords, no exaggeration, no placeholders.",
    prompt: `Question on the form: ${question}\n\nJob posting:\n${JSON.stringify(
      { title: job.title, company: job.company, about: job.about, skills: job.skills, responsibilities: job.responsibilities },
      null,
      2,
    )}\n\nCandidate profile:\n${JSON.stringify(profile, null, 2)}`,
  });

  const answer = result?.answer.trim();

  if (!answer || answer.length < 40 || answer.length > 1200 || /\[.*?\]|\{.*?\}|lorem/i.test(answer)) {
    return { text: fallback, source: "written from profile (template)" };
  }
  return { text: answer, source: "written from profile (Groq)" };
}
