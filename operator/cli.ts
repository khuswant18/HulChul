import "dotenv/config";
import readline from "node:readline";
import { parseArgs } from "node:util";
import { Journal } from "./journal.ts";
import { Run } from "./runner.ts";
import { defaultAuthority, type Approval, type RunState } from "./types.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    profile: { type: "string", default: "workspace/profiles/aarav-sharma.json" },
    max: { type: "string" },
    "allow-fees": { type: "boolean", default: false },
    "allow-commitments": { type: "boolean", default: false },
    "no-confirm-plan": { type: "boolean", default: false },
    "confirm-submits": { type: "boolean", default: false },
    auto: { type: "boolean", default: false },
    headless: { type: "boolean", default: false },
    resume: { type: "string" },
    list: { type: "boolean", default: false },
  },
});

const colour = { info: "\x1b[0m", action: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m", success: "\x1b[32m" };
const reset = "\x1b[0m";

function autoAnswer(a: Approval) {
  const preferred = { plan: "approve", limit: "keep", submit: "submit", fee: "skip", commitment: "skip", input: "skip" }[a.kind];
  return a.options.find((o) => o.value === preferred) ?? a.options[0];
}

function main() {
  if (values.list) {
    for (const s of Journal.list()) console.log(`${s.id}  ${s.status.padEnd(11)} ${s.profileName.padEnd(14)} ${s.goal.slice(0, 70)}`);
    return;
  }

  const browser = { headless: values.headless || process.env.HEADLESS === "true", slowMo: Number(process.env.SLOW_MO_MS ?? 120) };
  let run: Run;
  if (values.resume) {
    run = Run.resume(values.resume, browser);
  } else {
    const goal = positionals.join(" ").trim();
    if (!goal) {
      console.error('Give the goal in quotes, e.g. npm run operator -- "Apply to 2 remote frontend internships"');
      process.exit(1);
    }
    const authority = {
      ...defaultAuthority,
      maxApplications: values.max ? Number(values.max) : defaultAuthority.maxApplications,
      allowFees: values["allow-fees"],
      allowCommitments: values["allow-commitments"],
      confirmPlan: !values["no-confirm-plan"],
      confirmEachSubmit: values["confirm-submits"],
    };
    run = Run.start(goal, values.profile, authority, browser);
  }

  console.log(`Run ${run.state.id}  ·  evidence in runs/${run.state.id}/`);
  console.log("Type p to pause, r to resume, s to stop.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let printed = values.resume ? run.state.steps.length : 0;
  let asked: string | null = null;

  const onChange = (state: RunState) => {
    for (const step of state.steps.slice(printed)) {
      const t = new Date(step.at).toLocaleTimeString("en-GB");
      console.log(`${colour[step.level]}${t}  ${step.message}${reset}`);
    }
    printed = state.steps.length;

    const pending = run.control.pendingApproval;
    if (pending && asked !== pending.id) {
      asked = pending.id;
      console.log(`\n\x1b[1m${pending.title}\x1b[0m\n${pending.detail}\n`);
      pending.options.forEach((o, i) => console.log(`  ${i + 1}) ${o.label}`));
      if (values.auto) {
        const choice = autoAnswer(pending);
        console.log(`  → auto: ${choice.label}\n`);
        setImmediate(() => run.control.answer(pending.id, choice.value));
      } else {
        rl.setPrompt("Choose a number: ");
        rl.prompt();
      }
    }
  };
  run.journal.on("change", onChange);

  let textFor: { approval: Approval; value: string } | null = null;
  rl.on("line", (line) => {
    const input = line.trim();
    const pending = run.control.pendingApproval;
    if (textFor) {
      run.control.answer(textFor.approval.id, textFor.value, input);
      textFor = null;
      return;
    }
    if (pending) {
      const option = pending.options[Number(input) - 1];
      if (!option) return rl.prompt();
      if (pending.allowText && option.value === "text") {
        textFor = { approval: pending, value: option.value };
        rl.setPrompt("Your answer: ");
        return rl.prompt();
      }
      run.control.answer(pending.id, option.value);
      return;
    }
    if (input === "p") run.control.pause();
    else if (input === "r") run.control.resume();
    else if (input === "s") run.control.stop();
  });

  let interrupts = 0;
  process.on("SIGINT", () => {
    interrupts += 1;
    if (interrupts === 1) {
      console.log("\nStopping after the current action. Press Ctrl+C again to quit immediately.");
      run.control.stop();
    } else {
      console.log(`\nQuit. Resume later with: npm run operator -- --resume ${run.state.id}`);
      process.exit(130);
    }
  });

  run.done().then((state) => {
    onChange(state);
    rl.close();
    console.log(`\n${state.outcome}`);
    console.log(`Report: runs/${state.id}/report.html`);
    process.exit(state.status === "completed" ? 0 : 2);
  });
}

main();
