"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import JsonBlock from "@/components/JsonBlock";
import {
  type Approval,
  denyApproval,
  getStep,
  grantApproval,
  type Step,
} from "@/lib/api";
import { getApproverName, setApproverName } from "@/lib/storage";

export default function ApprovalCard({
  approval,
  onDecided,
}: {
  approval: Approval;
  onDecided: () => void;
}) {
  const [step, setStep] = useState<Step | null>(null);
  const [name, setName] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState<"grant" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(getApproverName());
    getStep(approval.execution_id, approval.step_id)
      .then(setStep)
      .catch(() => setStep(null));
  }, [approval.execution_id, approval.step_id]);

  const msRemaining = new Date(approval.timeout_at).getTime() - Date.now();
  const minutesRemaining = Math.round(msRemaining / 60000);
  const trimmedName = name.trim();

  async function decide(action: "grant" | "deny") {
    setError(null);
    setBusy(action);
    setApproverName(trimmedName);
    try {
      if (action === "grant") {
        await grantApproval(approval.id, trimmedName, rationale || undefined);
      } else {
        await denyApproval(approval.id, trimmedName, rationale || undefined);
      }
      onDecided();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium leading-none text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Awaiting review
            </span>
            <span className="text-xs text-ink-muted">
              {step ? step.kind : "Step"}
            </span>
          </div>
          <h2 className="truncate text-sm font-semibold text-ink">
            {step ? step.target : approval.step_id}
          </h2>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-ink-muted">
          {minutesRemaining <= 0
            ? "Expired"
            : `${minutesRemaining}m until timeout`}
        </span>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2 text-xs text-ink-muted">
          <span>Execution</span>
          <Link
            href={`/executions/${approval.execution_id}`}
            className="truncate font-mono text-accent hover:underline"
          >
            {approval.execution_id}
          </Link>
        </div>
        {approval.message && (
          <p className="rounded-md border border-line bg-surface-muted px-3 py-2.5 text-sm leading-relaxed text-ink-soft">
            {approval.message}
          </p>
        )}
        {step && <JsonBlock label="Arguments" value={step.args} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`approver-${approval.id}`}
              className="mb-1.5 block text-xs font-medium text-ink-muted"
            >
              Approver
            </label>
            <input
              id={`approver-${approval.id}`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-control w-full px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor={`rationale-${approval.id}`}
              className="mb-1.5 block text-xs font-medium text-ink-muted"
            >
              Rationale{" "}
              <span className="font-normal text-ink-faint">optional</span>
            </label>
            <input
              id={`rationale-${approval.id}`}
              type="text"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="field-control w-full px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => decide("deny")}
            disabled={!trimmedName || busy !== null}
            className="button-danger"
          >
            {busy === "deny" ? "Denying…" : "Deny"}
          </button>
          <button
            type="button"
            onClick={() => decide("grant")}
            disabled={!trimmedName || busy !== null}
            className="button-success"
          >
            {busy === "grant" ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>
    </article>
  );
}
