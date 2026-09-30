import crypto from "node:crypto";
import type { Approval, ApprovalKind, ApprovalOption } from "./types.ts";

export class StopRequested extends Error {
  constructor() {
    super("Stopped by the user");
  }
}

interface PendingApproval {
  approval: Approval;
  resolve: (decision: { value: string; text?: string }) => void;
  reject: (err: Error) => void;
}

// Pause, stop and approvals. The operator calls checkpoint() before every
// browser action, so a pause takes effect before the next click, not at the
// end of the job.
export class RunControl {
  private paused = false;
  private stopped = false;
  private resumeWaiters: (() => void)[] = [];
  private pending: PendingApproval | null = null;

  constructor(
    private hooks: {
      onPauseChange: (paused: boolean) => void;
      onApproval: (approval: Approval) => void;
      onDecision: (approval: Approval) => void;
    },
  ) {}

  get isPaused() {
    return this.paused;
  }

  pause() {
    if (this.paused || this.stopped) return;
    this.paused = true;
    this.hooks.onPauseChange(true);
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.hooks.onPauseChange(false);
    this.resumeWaiters.splice(0).forEach((wake) => wake());
  }

  stop() {
    this.stopped = true;
    this.paused = false;
    this.resumeWaiters.splice(0).forEach((wake) => wake());
    this.pending?.reject(new StopRequested());
    this.pending = null;
  }

  async checkpoint() {
    if (this.stopped) throw new StopRequested();
    while (this.paused) {
      await new Promise<void>((resolve) => this.resumeWaiters.push(resolve));
    }
    if (this.stopped) throw new StopRequested();
  }

  ask(request: {
    kind: ApprovalKind;
    title: string;
    detail: string;
    options: ApprovalOption[];
    boardId?: number | null;
    allowText?: boolean;
  }): Promise<{ value: string; text?: string }> {
    if (this.stopped) return Promise.reject(new StopRequested());
    const approval: Approval = {
      id: crypto.randomUUID().slice(0, 8),
      kind: request.kind,
      title: request.title,
      detail: request.detail,
      boardId: request.boardId ?? null,
      options: request.options,
      allowText: request.allowText ?? false,
      createdAt: new Date().toISOString(),
      decision: null,
    };
    return new Promise((resolve, reject) => {
      this.pending = { approval, resolve, reject };
      this.hooks.onApproval(approval);
    });
  }

  get pendingApproval() {
    return this.pending?.approval ?? null;
  }

  answer(id: string, value: string, text?: string) {
    const pending = this.pending;
    if (!pending || pending.approval.id !== id) return false;
    if (!pending.approval.options.some((o) => o.value === value)) return false;
    pending.approval.decision = { value, text, at: new Date().toISOString() };
    this.pending = null;
    this.hooks.onDecision(pending.approval);
    pending.resolve({ value, text });
    return true;
  }
}
