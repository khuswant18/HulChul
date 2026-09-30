import test from "node:test";
import assert from "node:assert/strict";
import { RunControl, StopRequested } from "../operator/control.ts";

const control = () => new RunControl({ onPauseChange: () => {}, onApproval: () => {}, onDecision: () => {} });

test("checkpoint waits while paused and continues on resume", async () => {
  const c = control();
  c.pause();
  let passed = false;
  const waiting = c.checkpoint().then(() => (passed = true));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(passed, false);
  c.resume();
  await waiting;
  assert.equal(passed, true);
});

test("stop wakes a paused run and makes it throw", async () => {
  const c = control();
  c.pause();
  const waiting = c.checkpoint();
  c.stop();
  await assert.rejects(waiting, StopRequested);
});

test("approvals only accept one of the offered options", async () => {
  const c = control();
  const answer = c.ask({ kind: "fee", title: "Pay?", detail: "", options: [{ value: "skip", label: "Skip" }] });
  const id = c.pendingApproval!.id;
  assert.equal(c.answer(id, "agree"), false);
  assert.equal(c.answer(id, "skip"), true);
  assert.deepEqual(await answer, { value: "skip", text: undefined });
});

test("stopping rejects a pending approval", async () => {
  const c = control();
  const answer = c.ask({ kind: "plan", title: "Plan?", detail: "", options: [{ value: "approve", label: "OK" }] });
  c.stop();
  await assert.rejects(answer, StopRequested);
});
