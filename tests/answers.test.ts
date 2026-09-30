import test from "node:test";
import assert from "node:assert/strict";
import { planAnswers, safetyCheck, type FormField } from "../operator/answers.ts";
import { Llm } from "../operator/llm.ts";
import { defaultAuthority } from "../operator/types.ts";
import { job, profile } from "./fixtures.ts";

process.env.OPERATOR_LLM = "off";

const field = (label: string, kind: FormField["kind"] = "text", options: string[] = [], required = true): FormField => ({
  name: label.toLowerCase().replace(/\W+/g, "_"),
  kind,
  label,
  required,
  options,
});

const plan = (fields: FormField[], authority = defaultAuthority) =>
  planAnswers(fields, { profile, job: job(), authority, llm: new Llm(), remembered: new Map() });

test("a fee checkbox is never ticked without permission", () => {
  const f = field("The final round has a one-time fee of ₹499. I agree to pay the assessment fee.", "checkbox");
  assert.equal(safetyCheck(f, defaultAuthority)?.action, "ask");
  assert.deepEqual(safetyCheck(f, { ...defaultAuthority, allowFees: true }), { field: f, action: "fill", value: "yes", source: "accepted: you allowed fees" });
});

test("a bond that mentions money is a contract term, not a fee", () => {
  const f = field("I accept a 12-month service agreement with a ₹50,000 early-exit clause.", "checkbox");
  const result = safetyCheck(f, defaultAuthority);
  assert.equal(result?.action === "ask" && result.kind, "commitment");
  // Allowing fees must not unlock a contract term.
  assert.equal(safetyCheck(f, { ...defaultAuthority, allowFees: true })?.action, "ask");
});

test("ID numbers are always asked, whatever the authority", () => {
  const all = { ...defaultAuthority, allowFees: true, allowCommitments: true };
  assert.equal(safetyCheck(field("Aadhaar number"), all)?.action, "ask");
});

test("an expected-stipend number field is not treated as a fee", () => {
  assert.equal(safetyCheck(field("Expected monthly stipend (INR)", "number"), defaultAuthority), null);
});

test("fills known fields from the profile and reports the source", async () => {
  const plans = await plan([
    field("Full name"),
    field("Email", "email"),
    field("How many hours per week can you commit?", "number"),
    field("Are you comfortable working with TypeScript?", "radio", ["Yes", "No"]),
    field("Do you know PHP?", "radio", ["Yes", "No"]),
    field("Rate your SQL skill", "select", ["1 - Beginner", "2", "3 - Comfortable", "4", "5 - Expert"]),
  ]);
  const values = plans.map((p) => (p.action === "fill" ? p.value : p.action));
  assert.deepEqual(values, ["Test Person", "test@example.test", "30", "Yes", "No", "3 - Comfortable"]);
});

test("asks instead of guessing when the profile has no answer", async () => {
  const [relocate, optional] = await plan([
    field("Are you willing to relocate to Pune?", "radio", ["Yes", "No"]),
    field("Twitter handle", "text", [], false),
  ]);
  assert.equal(relocate.action, "ask");
  assert.equal(optional.action, "leave");
});

test("reuses an answer the user already gave in this run", async () => {
  const remembered = new Map([["are you willing to relocate to pune?", "No"]]);
  const [p] = await planAnswers([field("Are you willing to relocate to Pune?", "radio", ["Yes", "No"])], {
    profile,
    job: job(),
    authority: defaultAuthority,
    llm: new Llm(),
    remembered,
  });
  assert.equal(p.action === "fill" && p.value, "No");
});
