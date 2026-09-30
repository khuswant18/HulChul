"use client";

import Link from "next/link";
import { useState } from "react";
import { api, fileUrl, statusLabel, whenOf, type RunState } from "@/lib/api";
import { ApprovalCard } from "./ApprovalCard";
import { PlanTable } from "./PlanTable";
import { SandboxPanel } from "./SandboxPanel";
import { statusTone } from "./status";
import { Timeline } from "./Timeline";
import { TrackerView } from "./TrackerView";
import { useRun } from "./useRun";
import { VerificationTable } from "./VerificationTable";

const phases: { key: RunState["phase"]; label: string }[] = [
  { key: "understand", label: "Understand" },
  { key: "search", label: "Search" },
  { key: "shortlist", label: "Shortlist" },
  { key: "apply", label: "Apply" },
  { key: "verify", label: "Verify" },
  { key: "report", label: "Report" },
];

const live = (s: RunState["status"]) => s === "running" || s === "paused" || s === "waiting";

export function RunView({ id }: { id: string }) {
  const { state, error, connected } = useRun(id);
  const [shot, setShot] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error && !state) {
    return (
      <div>
        <Link href="/" className="muted small">
          All runs
        </Link>
        <p className="error-text">{error}</p>
      </div>
    );
  }
  if (!state) {
    return (
      <div>
        <div className="skeleton w60" />
        <div className="skeleton w40" />
        <div className="skeleton w80" style={{ height: 220, marginTop: 32 }} />
      </div>
    );
  }

  const act = (fn: () => Promise<unknown>) => async () => {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const pending = state.approvals.find((a) => !a.decision && state.status === "waiting");
  const submitted = Object.values(state.applications).filter((a) => a.status === "submitted").length;
  const currentPhase = phases.findIndex((p) => p.key === state.phase);
  const finished = !live(state.status);

  const unresolved = Object.values(state.applications).some((a) => a.status === "submitting");
  const untried = state.plan.some((p) => !state.applications[String(p.boardId)]) && submitted < state.target;
  const resumable =
    ["interrupted", "stopped", "failed"].includes(state.status) || (state.status === "incomplete" && (unresolved || untried));
  const shownShot = shot ?? state.latestScreenshot;

  return (
    <div>
      <div className="run-head">
        <div>
          <Link href="/" className="back">
            All runs
          </Link>
          <h1>{state.goal}</h1>
          <div className="meta">
            <span>
              <b className={`status ${statusTone(state.status)}`}>{statusLabel[state.status]}</b>
            </span>
            <span>
              As <b>{state.profileName}</b>
            </span>
            <span>
              Applied <b className="mono">{submitted} / {state.target || "?"}</b>
            </span>
            <span>
              Reasoning <b>{state.llm.mode === "groq" ? `Groq, ${state.llm.calls} calls` : "rules only"}</b>
            </span>
            <span>Started {whenOf(state.createdAt)}</span>
            {state.resumedCount > 0 && <span>Resumed {state.resumedCount}×</span>}
            {!connected && live(state.status) && <span className="error-text">Reconnecting…</span>}
          </div>
        </div>
        <div className="controls">
          {state.status === "paused" ? (
            <button className="btn" onClick={act(() => api.resume(id))}>
              Continue
            </button>
          ) : (
            live(state.status) && (
              <button className="btn" onClick={act(() => api.pause(id))}>
                Pause
              </button>
            )
          )}
          {live(state.status) && (
            <button className="btn danger" onClick={act(() => api.stop(id))}>
              Stop
            </button>
          )}
          {resumable && (
            <button className="btn" onClick={act(() => api.restart(id))}>
              Resume run
            </button>
          )}
          {finished && (
            <a className="btn primary" href={fileUrl(id, "report.html")} target="_blank" rel="noreferrer">
              Open report
            </a>
          )}
        </div>
      </div>
      {actionError && <p className="error-text">{actionError}</p>}

      <ol className="phases" aria-label="Progress">
        {phases.map((p, i) => (
          <li key={p.key} className={state.phase === "done" || i < currentPhase ? "done" : i === currentPhase ? "current" : ""}>
            {p.label}
          </li>
        ))}
      </ol>

      <div className="run-body">
        <div>
          {pending && <ApprovalCard runId={id} approval={pending} />}

          {finished && state.outcome && (
            <div className={`outcome ${state.status === "completed" ? "ok" : state.status === "failed" ? "bad" : "warn"}`}>
              <strong>{state.outcome}</strong>
              {state.verification && state.verification.gaps.length > 0 && (
                <ul>
                  {state.verification.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              )}
              {state.status === "interrupted" && <p className="small">The operator process stopped mid-run. Resume to continue from the journal.</p>}
            </div>
          )}

          {state.verification && (
            <section>
              <h2>Verification</h2>
              <VerificationTable verification={state.verification} />
            </section>
          )}

          <section>
            <h2>Shortlist</h2>
            <PlanTable state={state} onShowScreenshot={setShot} />
          </section>

          <section>
            <h2>Timeline</h2>
            <Timeline steps={state.steps} onShowScreenshot={setShot} />
          </section>
        </div>

        <aside className="aside">
          <div>
            <h3>{shot ? "Screenshot" : live(state.status) ? "Browser, live" : "Last screen"}</h3>
            <div className="screen">
              {shownShot ? (
                <a href={fileUrl(id, shownShot)} target="_blank" rel="noreferrer">
                  <img src={fileUrl(id, shownShot)} alt="Operator browser" />
                </a>
              ) : (
                <div className="placeholder">No screenshot yet</div>
              )}
            </div>
            <div className="screen-caption">
              <span className="mono">{shownShot?.replace("shots/", "")}</span>
              {shot && (
                <button className="link-btn small" onClick={() => setShot(null)}>
                  Follow live
                </button>
              )}
            </div>
          </div>

          {state.mission && (
            <div>
              <h3>How the goal was read</h3>
              <dl className="kv">
                <dt>Roles</dt>
                <dd>{state.mission.keywords.join(", ")}</dd>
                <dt>Where</dt>
                <dd>{state.mission.locations.join(" or ") || "Anywhere"}</dd>
                <dt>Stipend</dt>
                <dd>{state.mission.minStipend ? `₹${state.mission.minStipend.toLocaleString("en-IN")}+ a month` : "Any"}</dd>
                <dt>Posted</dt>
                <dd>{state.mission.postedWithinDays ? `Last ${state.mission.postedWithinDays} days` : "Any time"}</dd>
                <dt>How many</dt>
                <dd>
                  {state.mission.maxApplications} asked, {state.target || "?"} allowed
                </dd>
                {state.mission.excludeCompanies.length > 0 && (
                  <>
                    <dt>Skip</dt>
                    <dd>{state.mission.excludeCompanies.join(", ")}</dd>
                  </>
                )}
              </dl>
              {state.mission.assumptions.map((a) => (
                <p key={a} className="hint">
                  {a}
                </p>
              ))}
            </div>
          )}

          <TrackerView profilePath={state.profilePath} refreshKey={Object.values(state.applications).filter((a) => a.loggedToTracker).length} />

          {live(state.status) && <SandboxPanel compact />}
        </aside>
      </div>
    </div>
  );
}
