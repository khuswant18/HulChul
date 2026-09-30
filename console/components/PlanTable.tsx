"use client";

import type { RunState } from "@/lib/api";

const statusText: Record<string, { label: string; tone: string }> = {
  queued: { label: "Queued", tone: "idle" },
  applying: { label: "Applying", tone: "live" },
  submitting: { label: "Submitting", tone: "warn" },
  submitted: { label: "Applied", tone: "ok" },
  skipped: { label: "Skipped", tone: "warn" },
  blocked: { label: "Blocked", tone: "bad" },
};

export function PlanTable({ state, onShowScreenshot }: { state: RunState; onShowScreenshot: (shot: string) => void }) {
  if (!state.plan.length && !state.rejected.length) {
    return <p className="empty">{state.phase === "understand" || state.phase === "search" ? "Searching the job board…" : "Nothing matched the goal."}</p>;
  }

  return (
    <>
      <table className="data">
        <thead>
          <tr>
            <th>Job</th>
            <th>Fit</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {state.plan.map((p, i) => {
            const app = state.applications[String(p.boardId)];
            const status = app ? statusText[app.status] : i < state.target ? { label: "Planned", tone: "idle" } : { label: "Backup", tone: "idle" };
            return (
              <tr key={p.boardId} className={app?.screenshot ? "clickable" : ""} onClick={() => app?.screenshot && onShowScreenshot(app.screenshot)}>
                <td>
                  {p.company} <span className="muted">· {p.title}</span>
                  <div className="why">{p.reasons.join(", ")}</div>
                  {app?.reason && <div className="why">{app.reason}</div>}
                </td>
                <td className="fit">{p.fit}%</td>
                <td>
                  <span className={`status ${status.tone}`}>{status.label}</span>
                  {app?.applicationId && <div className="mono small">{app.applicationId}</div>}
                  {app?.recovered && <div className="small muted">recovered</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {state.rejected.length > 0 && (
        <details className="left-out">
          <summary>{state.rejected.length} left out, and why</summary>
          <ul>
            {state.rejected.map((r) => (
              <li key={r.boardId}>
                {r.company}, {r.title}: {r.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
