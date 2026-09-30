"use client";

import { useEffect, useState } from "react";
import { api, type TrackerRow } from "@/lib/api";

export function TrackerView({ profilePath, refreshKey }: { profilePath: string; refreshKey: number }) {
  const [data, setData] = useState<{ path: string; rows: TrackerRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .tracker(profilePath)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [profilePath, refreshKey]);

  return (
    <div>
      <h3>Tracker file</h3>
      {error && <p className="error-text">{error}</p>}
      {!data && !error && <div className="skeleton w80" />}
      {data && (
        <>
          <p className="hint mono">{data.path}</p>
          {data.rows.length === 0 ? (
            <p className="hint">Empty. Rows appear here as applications go through.</p>
          ) : (
            <table className="data small">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>ID</th>
                  <th>Applied</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.applicationId || r.company + r.role}>
                    <td>
                      {r.company}
                      <div className="muted">{r.role}</div>
                    </td>
                    <td className="mono">{r.applicationId}</td>
                    <td className="mono muted">{r.appliedOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
