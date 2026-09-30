import type { RunState } from "@/lib/api";

export function statusTone(status: RunState["status"]) {
  switch (status) {
    case "completed":
      return "ok";
    case "running":
      return "live";
    case "waiting":
    case "paused":
    case "incomplete":
    case "interrupted":
      return "warn";
    case "failed":
      return "bad";
    default:
      return "idle";
  }
}
