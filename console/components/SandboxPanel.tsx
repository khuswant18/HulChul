"use client";

import { useEffect, useState } from "react";
import { api, type Faults } from "@/lib/api";

// Test-bench controls for the demo: break the sandbox on purpose and watch
// the operator recover. These talk to the sandbox, not to the operator.

const DHOBI_EXPRESS = 1051;

export function SandboxPanel({ compact = false }: { compact?: boolean }) {
  const [faults, setFaults] = useState<Faults | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.faults().then(setFaults).catch((e: Error) => setMessage(e.message));
  }, []);

  async function patch(change: Partial<Faults>, note?: string) {
    setBusy(true);
    try {
      setFaults(await api.setFaults(change));
      setMessage(note ?? null);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm("Reset the sandbox, the resumes and both trackers to their starting state?")) return;
    setBusy(true);
    try {
      await api.resetDemo();
      setFaults(await api.faults());
      setMessage("Demo data reset.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const closed = faults?.closedJobs.includes(DHOBI_EXPRESS) ?? false;

  return (
    <section className="sandbox">
      <h2>Sandbox faults</h2>
      {!compact && <p className="hint">Break the test environment on purpose. Each switch affects the next matching request.</p>}
      {faults ? (
        <div className="grid">
          <label className="check">
            <input type="checkbox" disabled={busy} checked={faults.submitGlitch} onChange={(e) => patch({ submitGlitch: e.target.checked })} />
            <span>
              Next submit returns 502
              <small>The application is saved, the browser sees an error.</small>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" disabled={busy} checked={faults.submitHang} onChange={(e) => patch({ submitHang: e.target.checked })} />
            <span>
              Next submit hangs for 30s
              <small>Saved, but the response is very late.</small>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" disabled={busy} checked={faults.mailOutage} onChange={(e) => patch({ mailOutage: e.target.checked })} />
            <span>
              Postbox is down
              <small>Webmail answers 503 to everything.</small>
            </span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              disabled={busy}
              checked={closed}
              onChange={(e) =>
                patch({
                  closedJobs: e.target.checked
                    ? [...(faults.closedJobs ?? []), DHOBI_EXPRESS]
                    : faults.closedJobs.filter((id) => id !== DHOBI_EXPRESS),
                })
              }
            />
            <span>
              Close the Dhobi Express posting
              <small>Stops accepting applications mid-run.</small>
            </span>
          </label>
        </div>
      ) : (
        !message && <div className="skeleton w60" />
      )}
      <div className="row">
        <button className="btn small" type="button" disabled={busy || !faults} onClick={() => patch({ expireSessionAfter: 2 }, "Current Kaamkaaj sessions will expire after 2 more requests.")}>
          Expire session soon
        </button>
        {!compact && (
          <button className="btn small" type="button" disabled={busy} onClick={reset}>
            Reset demo data
          </button>
        )}
      </div>
      {message && <p className="hint" role="status">{message}</p>}
    </section>
  );
}
