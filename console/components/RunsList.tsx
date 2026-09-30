"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, statusLabel, whenOf, type RunSummary } from "@/lib/api";
import { statusTone } from "./status";

export function RunsList() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api
        .runs()
        .then((r) => {
          setRuns(r);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section>
      <h2>Runs</h2>
      {error && <p className="error-text">{error}</p>}
      {!runs && !error && (
        <>
          <div className="skeleton w80" />
          <div className="skeleton w60" />
          <div className="skeleton w80" />
        </>
      )}
      {runs && runs.length === 0 && <p className="empty">No runs yet. Write a goal on the left and start one.</p>}
      {runs && runs.length > 0 && (
        <table className="data">
          <thead>
            <tr>
              <th>Started</th>
              <th>Goal</th>
              <th>Applied</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => router.push(`/runs/${r.id}`)}>
                <td className="mono muted">{whenOf(r.createdAt)}</td>
                <td className="goal-cell">
                  {r.goal}
                  <div className="muted small">{r.profileName}</div>
                </td>
                <td className="mono">{r.target ? `${r.submitted} / ${r.target}` : "-"}</td>
                <td>
                  <span className={`status ${statusTone(r.status)}`}>{statusLabel[r.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
