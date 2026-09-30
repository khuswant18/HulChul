// Synthetic data for the sandbox. Every company, person and job here is made up.
// Dates are stored relative to "today" so the demo behaves the same on any day.

export type QuestionKind = "text" | "number" | "date" | "url" | "textarea" | "select" | "yesno" | "checkbox";

export interface Question {
  name: string;
  label: string;
  kind: QuestionKind;
  required: boolean;
  options?: string[];
}

export interface SeedJob {
  id: number;
  title: string;
  company: string;
  location: string;
  mode: "Remote" | "On-site" | "Hybrid";
  type: "Internship" | "Full-time";
  stipendMin: number;
  stipendMax: number;
  durationMonths: number;
  postedDaysAgo: number;
  deadlineInDays: number;
  skills: string[];
  about: string;
  responsibilities: string[];
  questions: Question[];
  // Some companies take applications on their own careers site.
  externalApply?: { company: "zentrail" };
}

export interface SeedUser {
  email: string;
  name: string;
}

const hours: Question = {
  name: "weekly_hours",
  label: "How many hours per week can you commit?",
  kind: "number",
  required: true,
};

const startDate: Question = {
  name: "start_date",
  label: "Earliest start date",
  kind: "date",
  required: true,
};

const github: Question = {
  name: "github_url",
  label: "Link to your GitHub profile",
  kind: "url",
  required: false,
};

export const users: SeedUser[] = [
  { email: "aarav.sharma@example.test", name: "Aarav Sharma" },
  { email: "meera.iyer@example.test", name: "Meera Iyer" },
];

export const jobs: SeedJob[] = [
  {
    id: 1041,
    title: "Frontend Engineering Intern",
    company: "Tiffinbox",
    location: "Remote",
    mode: "Remote",
    type: "Internship",
    stipendMin: 20000,
    stipendMax: 25000,
    durationMonths: 6,
    postedDaysAgo: 2,
    deadlineInDays: 12,
    skills: ["React", "TypeScript", "CSS"],
    about:
      "Tiffinbox runs subscription meal plans for 40,000 office-goers across five cities. The web team owns the ordering flow, the kitchen dashboard and the delivery partner app.",
    responsibilities: [
      "Build and ship screens in our React + TypeScript ordering app",
      "Turn Figma designs into accessible, responsive components",
      "Fix bugs reported by customer support within the sprint",
    ],
    questions: [
      hours,
      startDate,
      github,
      { name: "motivation", label: "Why do you want to intern at Tiffinbox?", kind: "textarea", required: true },
    ],
  },
  {
    id: 1042,
    title: "Full-Stack Intern (Next.js)",
    company: "Ledgerly",
    location: "Remote",
    mode: "Remote",
    type: "Internship",
    stipendMin: 30000,
    stipendMax: 30000,
    durationMonths: 6,
    postedDaysAgo: 4,
    deadlineInDays: 10,
    skills: ["Next.js", "Node.js", "PostgreSQL", "TypeScript"],
    about:
      "Ledgerly is accounting software for small Indian businesses. We are a team of 18 and our product is used by 9,000 shops for GST filing.",
    responsibilities: [
      "Work on the invoicing module (Next.js front end, Node.js API)",
      "Write integration tests for GST calculations",
      "Pair with a senior engineer on code reviews every week",
    ],
    questions: [
      { name: "ts_comfort", label: "Are you comfortable working with TypeScript?", kind: "yesno", required: true },
      { name: "expected_stipend", label: "Expected monthly stipend (INR)", kind: "number", required: true },
      {
        name: "assessment_fee",
        label: "The final round is a proctored assessment with a one-time fee of ₹499. I agree to pay the assessment fee.",
        kind: "checkbox",
        required: true,
      },
    ],
  },
  {
    id: 1043,
    title: "React Native Intern",
    company: "Gaadi Mitra",
    location: "Bengaluru",
    mode: "On-site",
    type: "Internship",
    stipendMin: 18000,
    stipendMax: 18000,
    durationMonths: 4,
    postedDaysAgo: 3,
    deadlineInDays: 9,
    skills: ["React Native", "JavaScript"],
    about: "Gaadi Mitra helps car owners book servicing from verified local garages.",
    responsibilities: ["Build features in our React Native app", "Test releases on low-end Android phones"],
    questions: [
      { name: "relocate", label: "Are you willing to relocate to Bengaluru?", kind: "yesno", required: true },
      hours,
    ],
  },
  {
    id: 1044,
    title: "Frontend Intern",
    company: "Chaiwala Labs",
    location: "Remote",
    mode: "Remote",
    type: "Internship",
    stipendMin: 8000,
    stipendMax: 10000,
    durationMonths: 3,
    postedDaysAgo: 1,
    deadlineInDays: 14,
    skills: ["HTML", "CSS", "JavaScript", "React"],
    about: "A two-person studio building websites for cafes and restaurants.",
    responsibilities: ["Build landing pages", "Maintain client websites"],
    questions: [hours],
  },
  {
    id: 1045,
    title: "UI Engineering Intern",
    company: "Pixelkraft",
    location: "Remote",
    mode: "Remote",
    type: "Internship",
    stipendMin: 22000,
    stipendMax: 22000,
    durationMonths: 6,
    postedDaysAgo: 12,
    deadlineInDays: 3,
    skills: ["React", "Storybook", "CSS"],
    about: "Pixelkraft is a design agency that builds design systems for fintech clients.",
    responsibilities: ["Build components for client design systems", "Document components in Storybook"],
    questions: [hours, github],
  },
  {
    id: 1046,
    title: "Backend Intern (Node.js)",
    company: "Ledgerly",
    location: "Remote",
    mode: "Remote",
    type: "Internship",
    stipendMin: 28000,
    stipendMax: 28000,
    durationMonths: 6,
    postedDaysAgo: 5,
    deadlineInDays: 10,
    skills: ["Node.js", "MongoDB", "REST APIs", "TypeScript"],
    about: "Ledgerly's platform team runs the APIs behind invoicing, payments and GST filing.",
    responsibilities: ["Build REST endpoints", "Improve slow MongoDB queries", "Add monitoring to background jobs"],
    questions: [
      hours,
      { name: "api_story", label: "Describe a REST API you have built", kind: "textarea", required: true },
    ],
  },
  {
    id: 1047,
    title: "Data Analyst Intern",
    company: "Kirana Insights",
    location: "Remote",
    mode: "Remote",
    type: "Internship",
    stipendMin: 15000,
    stipendMax: 15000,
    durationMonths: 3,
    postedDaysAgo: 2,
    deadlineInDays: 8,
    skills: ["SQL", "Python", "Excel", "Power BI"],
    about: "We help 2,000 neighbourhood stores understand what sells, using their billing data.",
    responsibilities: ["Write SQL for weekly store reports", "Build Power BI dashboards", "Clean messy billing exports"],
    questions: [
      { name: "sql_level", label: "Rate your SQL skill", kind: "select", required: true, options: ["1 - Beginner", "2", "3 - Comfortable", "4", "5 - Expert"] },
      hours,
      startDate,
    ],
  },
  {
    id: 1048,
    title: "Data Analyst Intern",
    company: "Metrobus Analytics",
    location: "Pune",
    mode: "Hybrid",
    type: "Internship",
    stipendMin: 12000,
    stipendMax: 12000,
    durationMonths: 4,
    postedDaysAgo: 6,
    deadlineInDays: 6,
    skills: ["SQL", "Excel", "Tableau"],
    about: "Ridership analytics for city bus operators in Maharashtra.",
    responsibilities: ["Analyse ridership data", "Prepare monthly reports for operators"],
    questions: [
      { name: "current_city", label: "Current city", kind: "text", required: true },
      hours,
    ],
  },
  {
    id: 1049,
    title: "Frontend Developer Intern",
    company: "Zentrail",
    location: "Remote",
    mode: "Remote",
    type: "Internship",
    stipendMin: 25000,
    stipendMax: 25000,
    durationMonths: 6,
    postedDaysAgo: 3,
    deadlineInDays: 11,
    skills: ["React", "TypeScript", "Tailwind CSS"],
    about: "Zentrail builds route planning software for logistics fleets. Applications go through our own careers site.",
    responsibilities: ["Build map and dispatch screens in React", "Improve performance of large data tables"],
    questions: [],
    externalApply: { company: "zentrail" },
  },
  {
    id: 1050,
    title: "Machine Learning Intern",
    company: "Shakti AI",
    location: "Bengaluru",
    mode: "On-site",
    type: "Internship",
    stipendMin: 35000,
    stipendMax: 35000,
    durationMonths: 6,
    postedDaysAgo: 1,
    deadlineInDays: 15,
    skills: ["Python", "PyTorch", "Machine Learning"],
    about: "Speech recognition for Indian languages.",
    responsibilities: ["Train and evaluate ASR models", "Build data pipelines for audio"],
    questions: [hours],
  },
  {
    id: 1051,
    title: "Full-Stack Intern",
    company: "Dhobi Express",
    location: "Remote",
    mode: "Remote",
    type: "Internship",
    stipendMin: 16000,
    stipendMax: 16000,
    durationMonths: 3,
    postedDaysAgo: 6,
    deadlineInDays: 5,
    skills: ["React", "Node.js", "MongoDB"],
    about: "Laundry pickup and delivery in Hyderabad and Chennai. Small team, fast releases.",
    responsibilities: ["Build the customer booking flow", "Write APIs for the rider app"],
    questions: [
      hours,
      startDate,
      { name: "current_city", label: "Current city", kind: "text", required: true },
    ],
  },
  {
    id: 1052,
    title: "Product Design Intern",
    company: "Pixelkraft",
    location: "Mumbai",
    mode: "On-site",
    type: "Internship",
    stipendMin: 15000,
    stipendMax: 15000,
    durationMonths: 3,
    postedDaysAgo: 2,
    deadlineInDays: 10,
    skills: ["Figma", "User Research"],
    about: "Design work for fintech clients.",
    responsibilities: ["Wireframes and prototypes", "Usability testing"],
    questions: [{ name: "portfolio", label: "Portfolio link", kind: "url", required: true }],
  },
  {
    id: 1053,
    title: "Software Engineering Intern (Frontend)",
    company: "Nimbus Health",
    location: "Remote",
    mode: "Remote",
    type: "Internship",
    stipendMin: 24000,
    stipendMax: 24000,
    durationMonths: 6,
    postedDaysAgo: 5,
    deadlineInDays: 9,
    skills: ["React", "JavaScript", "Jest"],
    about: "Nimbus Health builds appointment and records software for clinics.",
    responsibilities: ["Build patient-facing screens", "Write tests with Jest and Testing Library"],
    questions: [hours],
  },
  {
    id: 1054,
    title: "Web Developer Intern",
    company: "Sabzi Cart",
    location: "Hyderabad",
    mode: "On-site",
    type: "Internship",
    stipendMin: 15000,
    stipendMax: 15000,
    durationMonths: 3,
    postedDaysAgo: 1,
    deadlineInDays: 7,
    skills: ["JavaScript", "React", "PHP"],
    about: "Grocery delivery from local vendors.",
    responsibilities: ["Maintain the vendor portal", "Build new storefront pages"],
    questions: [hours],
  },
];

// Aarav applied to Nimbus Health by hand last week. It is in the board and in
// his tracker spreadsheet, so the operator must not apply again.
export const existingApplications = [
  { jobId: 1053, email: "aarav.sharma@example.test", applicationId: "KK-30207", daysAgo: 4 },
];
