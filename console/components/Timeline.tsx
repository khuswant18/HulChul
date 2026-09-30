"use client";

import { useEffect, useRef } from "react";
import { timeOf, type Step } from "@/lib/api";

export function Timeline({ steps, onShowScreenshot }: { steps: Step[]; onShowScreenshot: (shot: string) => void }) {
  const list = useRef<HTMLOListElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = list.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [steps.length]);

  if (!steps.length) return <p className="empty">Starting…</p>;

  return (
    <ol
      className="timeline"
      ref={list}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
    >
      {steps.map((s) => (
        <li key={s.n} className={s.level}>
          <span className="t">{timeOf(s.at)}</span>
          <span className="msg">{s.message}</span>
          <span>
            {s.screenshot && (
              <button className="link-btn small" onClick={() => onShowScreenshot(s.screenshot!)}>
                view
              </button>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
