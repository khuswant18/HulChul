"use client";

import type { RunState } from "@/lib/api";

type Verification = NonNullable<RunState["verification"]>;
type Result = Verification["jobs"][number]["board"];

const cell: Record<Result, { text: string; cls: string }> = {
  pass: { text: "yes", cls: "pass" },
  fail: { text: "no", cls: "fail" },
  unknown: { text: "unknown", cls: "unknown" },
  "n/a": { text: "n/a", cls: "na" },
};

function Check({ result }: { result: Result }) {
  return <span className={`check-cell ${cell[result].cls}`}>{cell[result].text}</span>;
}

export function VerificationTable({ verification }: { verification: Verification }) {
  if (!verification.jobs.length) return <p className="empty">No applications to verify.</p>;
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Application</th>
          <th>On board</th>
          <th>Email</th>
          <th>Tracker</th>
          <th>No duplicate</th>
          <th>Fits goal</th>
        </tr>
      </thead>
      <tbody>
        {verification.jobs.map((j) => (
          <tr key={j.boardId}>
            <td>
              <span className="job-title">{j.company}</span> <span className="mono small muted">{j.applicationId}</span>
              <div style={{ marginTop: 6 }}>
                <span className={`pill ${j.verdict === "verified" ? "ok" : j.verdict === "partly verified" ? "warn" : "bad"}`}>{j.verdict}</span>
              </div>
              {j.notes.length > 0 && <div className="why">{j.notes.join("; ")}</div>}
            </td>
            <td><Check result={j.board} /></td>
            <td><Check result={j.email} /></td>
            <td><Check result={j.tracker} /></td>
            <td><Check result={j.duplicates} /></td>
            <td><Check result={j.filters} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
