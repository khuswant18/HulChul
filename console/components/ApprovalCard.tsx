"use client";

import { useState } from "react";
import { api, type Approval } from "@/lib/api";

const kindLabel: Record<Approval["kind"], string> = {
  plan: "Check the plan",
  limit: "Above your limit",
  fee: "Money involved",
  commitment: "Contract term",
  input: "Missing information",
  submit: "Ready to submit",
};

// The safe choice is never styled as the primary button for money or
// contract questions; there the user has to pick deliberately.
const primaryChoices = new Set(["approve", "submit", "text", "keep"]);

export function ApprovalCard({ runId, approval }: { runId: string; approval: Approval }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(value: string) {
    if (value === "text" && !text.trim()) {
      setError("Type an answer first.");
      return;
    }
    setSending(value);
    setError(null);
    try {
      await api.answer(runId, approval.id, value, value === "text" ? text.trim() : undefined);
    } catch (e) {
      setError((e as Error).message);
      setSending(null);
    }
  }

  return (
    <div className="approval" role="alertdialog" aria-labelledby={`approval-${approval.id}`}>
      <div className="small muted">{kindLabel[approval.kind]}. The operator is waiting for you.</div>
      <h2 id={`approval-${approval.id}`}>{approval.title}</h2>
      <pre>{approval.detail}</pre>
      {approval.allowText && (
        <p>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Your answer" aria-label="Your answer" />
        </p>
      )}
      <div className="row">
        {approval.options.map((o) => (
          <button
            key={o.value}
            className={primaryChoices.has(o.value) ? "btn primary" : "btn"}
            disabled={sending !== null}
            onClick={() => choose(o.value)}
          >
            {sending === o.value ? "Sending…" : o.label}
          </button>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
