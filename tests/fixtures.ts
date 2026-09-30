import type { Profile } from "../operator/profile.ts";
import type { JobListing, Mission } from "../operator/types.ts";

export const profile: Profile = {
  name: "Test Person",
  email: "test@example.test",
  phone: "9000000000",
  city: "Indore",
  education: "B.Tech IT, third year",
  headline: "Student who builds web apps",
  links: { github: "https://github.com/test-person" },
  skills: ["React", "TypeScript", "Node.js"],
  skillLevels: { SQL: 3 },
  projects: [{ name: "Notes", summary: "a notes app", skills: ["React"] }],
  availability: { hoursPerWeek: 30, startDate: "2026-10-10", noticePeriod: "Immediate" },
  preferences: { expectedStipend: 18000, willingToRelocate: null },
  resumePath: "workspace/resumes/test.pdf",
  trackerPath: "workspace/trackers/test.xlsx",
};

const DAY = 86_400_000;

export function job(overrides: Partial<JobListing> = {}): JobListing {
  return {
    boardId: 1,
    url: "http://localhost:4010/jobs/1",
    title: "Frontend Intern",
    company: "Somefirm",
    location: "Remote",
    mode: "Remote",
    stipendMin: 20000,
    stipendMax: 20000,
    postedOn: new Date(Date.now() - 2 * DAY).toISOString(),
    deadline: new Date(Date.now() + 10 * DAY).toISOString(),
    skills: ["React", "TypeScript"],
    about: "We build things.",
    responsibilities: ["Build screens"],
    channel: "kaamkaaj",
    applyUrl: null,
    state: "open",
    existingApplicationId: null,
    ...overrides,
  };
}

export const mission: Mission = {
  summary: "",
  keywords: ["frontend"],
  locations: ["Remote"],
  minStipend: 15000,
  postedWithinDays: 7,
  maxApplications: 3,
  excludeCompanies: [],
  assumptions: [],
};
