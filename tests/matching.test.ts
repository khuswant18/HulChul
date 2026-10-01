import test from "node:test";
import assert from "node:assert/strict";
import { shortlist } from "../operator/matching.ts";
import { job, mission, profile } from "./fixtures.ts";

const DAY = 86_400_000;

test("drops jobs that break the goal, with a reason for each", () => {
  const jobs = [
    job({ boardId: 1 }),
    job({ boardId: 2, location: "Pune" }),
    job({ boardId: 3, stipendMin: 10000, stipendMax: 16000 }),
    job({ boardId: 4, postedOn: new Date(Date.now() - 12 * DAY).toISOString() }),
    job({ boardId: 5, state: "closed" }),
    job({ boardId: 6, skills: ["Go", "Kubernetes", "Rust"] }),
  ];
  const { ranked, rejected } = shortlist(jobs, mission, profile, []);
  assert.deepEqual(ranked.map((r) => r.boardId), [1]);
  const reasons = Object.fromEntries(rejected.map((r) => [r.boardId, r.reason]));
  assert.match(reasons[2], /Location is Pune/);
  assert.match(reasons[3], /Stipend starts at ₹10,000/);
  assert.match(reasons[4], /Posted 12 days ago/);
  assert.match(reasons[5], /closed/);
  assert.match(reasons[6], /Weak skill match/);
});

test("skips jobs already in the tracker", () => {
  const listing = job({ boardId: 9, company: "Nimbus", title: "Frontend Intern" });
  const row = { appliedOn: "", company: "Nimbus", role: "Frontend Intern", location: "", stipend: 0, source: "", jobUrl: "other", applicationId: "KK-1", status: "", notes: "", runId: "" };
  const { ranked, rejected } = shortlist([listing], mission, profile, [row]);
  assert.equal(ranked.length, 0);
  assert.match(rejected[0].reason, /Already applied \(KK-1\)/);
});

test("ranks by skill fit, then stipend", () => {
  const { ranked } = shortlist(
    [
      job({ boardId: 1, skills: ["React", "Vue"], stipendMax: 40000 }),
      job({ boardId: 2, stipendMax: 20000 }),
      job({ boardId: 3, stipendMax: 25000 }),
    ],
    mission,
    profile,
    [],
  );
  assert.deepEqual(ranked.map((r) => r.boardId), [3, 2, 1]);
});

test("rejects excluded companies and passed deadlines", () => {
  const { ranked, rejected } = shortlist(
    [
      job({ boardId: 1, company: "Chaiwala Labs" }),
      job({ boardId: 2, deadline: new Date(Date.now() - DAY).toISOString() }),
    ],
    { ...mission, excludeCompanies: ["chaiwala labs"] },
    profile,
    [],
  );
  assert.equal(ranked.length, 0);
  const reasons = Object.fromEntries(rejected.map((r) => [r.boardId, r.reason]));
  assert.match(reasons[1], /Chaiwala Labs is excluded/);
  assert.match(reasons[2], /deadline has passed/);
});

test("judges recency against the given time", () => {
  const listing = job({ postedOn: "2026-09-20T10:00:00.000Z", deadline: "2026-12-31T00:00:00.000Z" });
  const early = shortlist([listing], mission, profile, [], Date.parse("2026-09-22T10:00:00.000Z"));
  assert.equal(early.ranked.length, 1);
  assert.ok(early.ranked[0].reasons.includes("Posted 2d ago"));
  const late = shortlist([listing], mission, profile, [], Date.parse("2026-10-01T10:00:00.000Z"));
  assert.match(late.rejected[0].reason, /Posted 11 days ago/);
});
