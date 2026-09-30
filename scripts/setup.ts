import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { listProfiles, loadProfile, ProfileSchema, type Profile } from "../operator/profile.ts";
import { writeTracker } from "../operator/tracker.ts";

const boardUrl = process.env.KAAMKAAJ_URL ?? "http://localhost:4010";

async function resetSandbox() {
  try {
    const res = await fetch(`${boardUrl}/__admin/reset`, { method: "POST" });
    if (res.ok) return "reset through the running sandbox";
  } catch {}
  const { reset } = await import("../sandbox/store.ts");
  reset();
  return "state file reset (sandbox not running)";
}

async function writeResume(profile: Profile) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 790;

  const line = (text: string, size = 10.5, font = regular, gap = 15) => {
    page.drawText(text, { x: 56, y, size, font, color: rgb(0.1, 0.1, 0.12) });
    y -= gap;
  };
  const wrap = (text: string, width = 88) => {
    const words = text.split(" ");
    let current = "";
    for (const word of words) {
      if ((current + " " + word).trim().length > width) {
        line(current);
        current = word;
      } else current = (current + " " + word).trim();
    }
    if (current) line(current);
  };

  line(profile.name, 20, bold, 24);
  line(`${profile.email}  ·  ${profile.phone}  ·  ${profile.city}`);
  if (profile.links.github) line(profile.links.github);
  y -= 10;
  line("EDUCATION", 10, bold);
  wrap(profile.education);
  y -= 8;
  line("SKILLS", 10, bold);
  wrap(profile.skills.join(", "));
  y -= 8;
  line("PROJECTS", 10, bold);
  for (const project of profile.projects) {
    line(project.name, 10.5, bold);
    wrap(project.summary.charAt(0).toUpperCase() + project.summary.slice(1) + ".");
    y -= 4;
  }
  y -= 8;
  line("AVAILABILITY", 10, bold);
  line(`${profile.availability.hoursPerWeek} hours a week from ${profile.availability.startDate}`);
  y -= 30;
  line("Synthetic resume generated for a sandbox demo.", 8, regular);

  fs.mkdirSync(path.dirname(profile.resumePath), { recursive: true });
  fs.writeFileSync(profile.resumePath, await pdf.save());
}

async function main() {
  console.log(`Sandbox: ${await resetSandbox()}`);

  for (const { file } of listProfiles()) {
    const profile = ProfileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    await writeResume(profile);
    loadProfile(file);

    const rows =
      profile.email === "aarav.sharma@example.test"
        ? [
            {
              appliedOn: new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10),
              company: "Nimbus Health",
              role: "Software Engineering Intern (Frontend)",
              location: "Remote",
              stipend: 24000,
              source: "Kaamkaaj",
              jobUrl: `${boardUrl}/jobs/1053`,
              applicationId: "KK-30207",
              status: "Applied",
              notes: "Applied manually",
              runId: "",
            },
          ]
        : [];
    await writeTracker(profile.trackerPath, rows);
    console.log(`${profile.name}: resume ${profile.resumePath}, tracker ${profile.trackerPath} (${rows.length} row)`);
  }

  if (process.argv.includes("--runs")) {
    fs.rmSync("runs", { recursive: true, force: true });
    console.log("Deleted old runs");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
