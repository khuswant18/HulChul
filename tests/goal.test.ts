import test from "node:test";
import assert from "node:assert/strict";
import { parseGoalWithRules } from "../operator/goal.ts";
import { profile } from "./fixtures.ts";

test("reads count, stipend, recency, location and roles", () => {
  const m = parseGoalWithRules(
    "Apply to up to 3 remote frontend or full-stack internships posted in the last week that pay at least ₹15,000 a month",
    profile,
  );
  assert.deepEqual(m.keywords, ["frontend", "full stack"]);
  assert.deepEqual(m.locations, ["Remote"]);
  assert.equal(m.minStipend, 15000);
  assert.equal(m.postedWithinDays, 7);
  assert.equal(m.maxApplications, 3);
});

test("understands 12k, word numbers and several cities", () => {
  const m = parseGoalWithRules("Find data analyst internships that are remote or in Pune, paying at least 12k a month, and apply to the best two", profile);
  assert.deepEqual(m.keywords, ["data analyst"]);
  assert.deepEqual(m.locations, ["Remote", "Pune"]);
  assert.equal(m.minStipend, 12000);
  assert.equal(m.maxApplications, 2);
});

test("does not mistake the count or a year for a stipend", () => {
  const m = parseGoalWithRules("Apply to 2 frontend internships starting in 2026", profile);
  assert.equal(m.minStipend, null);
  assert.equal(m.maxApplications, 2);
});

test("picks up excluded companies and 'anywhere'", () => {
  const m = parseGoalWithRules("Apply to 5 React internships anywhere, skip Chaiwala Labs.", profile);
  assert.deepEqual(m.excludeCompanies, ["Chaiwala Labs"]);
  assert.deepEqual(m.locations, []);
  assert.equal(m.maxApplications, 5);
});

test("'the X internship' means one application", () => {
  assert.equal(parseGoalWithRules("Apply to the React Native internship in Bengaluru.", profile).maxApplications, 1);
});

test("falls back to profile skills when no role is named, and says so", () => {
  const m = parseGoalWithRules("Apply to 2 internships paying 20k", profile);
  assert.deepEqual(m.keywords, ["react", "typescript"]);
  assert.equal(m.assumptions.length, 1);
});
