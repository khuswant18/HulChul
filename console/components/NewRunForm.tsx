"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Authority, type ProfileOption } from "@/lib/api";

const examples = [
  {
    profile: "aarav",
    goal: "Apply to up to 3 remote frontend or full-stack internships posted in the last week that pay at least ₹15,000 a month.",
  },
  {
    profile: "meera",
    goal: "Find data analyst internships that are remote or in Pune, paying at least 12k a month, and apply to the best two.",
  },
  {
    profile: "aarav",
    goal: "Apply to 5 React internships anywhere, skip Chaiwala Labs.",
  },
  {
    profile: "aarav",
    goal: "Apply to the React Native internship in Bengaluru.",
  },
];

export function NewRunForm() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileOption[] | null>(null);
  const [profile, setProfile] = useState("");
  const [goal, setGoal] = useState("");
  const [authority, setAuthority] = useState<Authority>({
    maxApplications: 3,
    allowFees: false,
    allowCommitments: false,
    confirmPlan: true,
    confirmEachSubmit: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api
      .profiles()
      .then((list) => {
        setProfiles(list);
        if (list[0]) setProfile(list[0].file);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const set = <K extends keyof Authority>(key: K, value: Authority[K]) => setAuthority((a) => ({ ...a, [key]: value }));

  function applyExample(example: (typeof examples)[number]) {
    setGoal(example.goal);
    const match = profiles?.find((p) => p.file.includes(example.profile));
    if (match) setProfile(match.file);
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStarting(true);
    try {
      const { id } = await api.start(goal, profile, authority);
      router.push(`/runs/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setStarting(false);
    }
  }

  return (
    <form className="composer" onSubmit={start}>
      <div>
        <h1>New run</h1>
        <p className="lead">
          Say what you want in plain English. The operator searches the job board, applies in the browser, updates your
          tracker and then checks its own work.
        </p>
      </div>

      <label className="field">
        <span>Goal</span>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Apply to 3 remote frontend internships paying at least 15k" required />
      </label>
      <div className="examples">
        <span className="hint">Or start from one of these:</span>
        {examples.map((ex) => (
          <button type="button" key={ex.goal} onClick={() => applyExample(ex)}>
            {ex.goal}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Applying as</span>
        {profiles ? (
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            {profiles.map((p) => (
              <option key={p.file} value={p.file}>
                {p.name}: {p.headline}
              </option>
            ))}
          </select>
        ) : (
          <div className="skeleton w80" />
        )}
        <span className="hint">Answers come from this profile file. Anything missing is asked, not guessed.</span>
      </label>

      <fieldset className="limits">
        <legend>What the operator may do without asking</legend>
        <div className="row">
          <input
            id="max"
            type="number"
            min={1}
            max={10}
            value={authority.maxApplications}
            onChange={(e) => set("maxApplications", Math.max(1, Number(e.target.value) || 1))}
          />
          <label htmlFor="max">applications at most</label>
        </div>
        <label className="check">
          <input type="checkbox" checked={authority.allowFees} onChange={(e) => set("allowFees", e.target.checked)} />
          <span>
            Agree to fees
            <small>Off: any form that asks you to pay is sent to you first.</small>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={authority.allowCommitments} onChange={(e) => set("allowCommitments", e.target.checked)} />
          <span>
            Accept contract terms
            <small>Bonds, service agreements, exit penalties.</small>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={authority.confirmPlan} onChange={(e) => set("confirmPlan", e.target.checked)} />
          <span>
            Show me the shortlist before applying
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={authority.confirmEachSubmit} onChange={(e) => set("confirmEachSubmit", e.target.checked)} />
          <span>
            Ask before every submit
            <small>Shows the filled answers for each application first.</small>
          </span>
        </label>
      </fieldset>

      {error && <p className="error-text">{error}</p>}
      <div>
        <button className="btn primary" disabled={starting || !goal.trim() || !profile}>
          {starting ? "Starting…" : "Start run"}
        </button>
      </div>
    </form>
  );
}
