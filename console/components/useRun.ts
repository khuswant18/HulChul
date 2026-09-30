"use client";

import { useEffect, useState } from "react";
import { OPERATOR_URL, api, type RunState } from "@/lib/api";

export function useRun(id: string) {
  const [state, setState] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(`${OPERATOR_URL}/api/runs/${id}/events`);
    source.onopen = () => {
      setConnected(true);
      setError(null);
    };
    source.onmessage = (event) => setState(JSON.parse(event.data) as RunState);
    source.onerror = () => {
      setConnected(false);

      api.run(id).catch((e: Error) => setError(e.message));
    };
    return () => source.close();
  }, [id]);

  return { state, error, connected, setState };
}
