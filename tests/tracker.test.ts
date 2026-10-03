import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readTracker, upsertTrackerRow } from "../operator/tracker.ts";

const row = (id: string, status = "Applied") => ({
  appliedOn: "2026-09-29",
  company: "Tiffinbox",
  role: "Frontend Engineering Intern",
  location: "Remote",
  stipend: 25000,
  source: "Kaamkaaj",
  jobUrl: `http://localhost:4010/jobs/${id}`,
  applicationId: `KK-${id}`,
  status,
  notes: "",
  runId: "test",
});

test("writing the same application twice leaves one row", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tracker-")), "t.xlsx");
  assert.equal(await upsertTrackerRow(file, row("1")), "added");
  assert.equal(await upsertTrackerRow(file, row("1", "Interview")), "updated");
  assert.equal(await upsertTrackerRow(file, row("2")), "added");
  const rows = await readTracker(file);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, "Interview");
  assert.equal(rows[0].stipend, 25000);
});

test("a missing tracker reads as empty", async () => {
  assert.deepEqual(await readTracker("/nonexistent/tracker.xlsx"), []);
});

test("rows without a job URL are kept apart by application ID", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tracker-")), "t.xlsx");
  assert.equal(await upsertTrackerRow(file, { ...row("1"), jobUrl: "" }), "added");
  assert.equal(await upsertTrackerRow(file, { ...row("2"), jobUrl: "" }), "added");
  const rows = await readTracker(file);
  assert.deepEqual(rows.map((r) => r.applicationId), ["KK-1", "KK-2"]);
});
