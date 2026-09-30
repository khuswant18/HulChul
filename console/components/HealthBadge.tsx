"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function HealthBadge() {
  const [text, setText] = useState<React.ReactNode>(null);

  useEffect(() => {
    api
      .health()
      .then((h) =>
        setText(
          h.llm === "groq" ? (
            <>
              Reasoning: <b>Groq</b> <span className="mono">{h.model}</span>
            </>
          ) : (
            <>
              Reasoning: <b>rules only</b> (no API key)
            </>
          ),
        ),
      )
      .catch(() => setText(<span className="error-text">Operator API offline</span>));
  }, []);

  return <div className="health">{text}</div>;
}
