"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import BranchIcon from "@/components/executions/BranchIcon";
import { useExecutionWorkspace } from "@/components/executions/ExecutionWorkspace";
import ForkForm from "@/components/executions/ForkForm";
import JsonBlock from "@/components/JsonBlock";
import StatusBadge from "@/components/StatusBadge";
import { type Event, type Execution, type Step } from "@/lib/api";
import {
  executionHref,
  executionLabel,
  isTerminal,
} from "@/lib/execution-tree";

const STEP_STATUS_STYLES: Record<string, string> = {
  proposed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  allowed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  denied: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  awaiting_approval:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  executing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  succeeded:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const SETTLED_EVENTS = ["step.succeeded", "step.failed", "step.denied"];

export default function StepsPanel({
  executionId,
  events,
}: {
  executionId: string;
  events: Event[];
}) {
  const { tree, store, treeMode } = useExecutionWorkspace();
  const branch = tree.branches[executionId];
  const steps = branch?.steps ?? [];
  const error = branch?.stepsError;
  const loading = !branch?.steps && !error;
  const requestedStep = useSearchParams().get("step");
  const focusedStep = useRef<string | null>(null);
  const [forkingStep, setForkingStep] = useState<string | null>(null);
  useEffect(() => {
    if (!requestedStep) {
      focusedStep.current = null;
      return;
    }
    if (loading || focusedStep.current === requestedStep) return;
    const element = document.getElementById(`step-${requestedStep}`);
    if (element) {
      element.scrollIntoView({ block: "center" });
      element.focus({ preventScroll: true });
      focusedStep.current = requestedStep;
    }
  }, [requestedStep, loading, steps]);

  // A fork copies the steps settled at or before its event, so a step's fork
  // point is the event that settled it.
  const forkSeqs = useMemo(() => {
    const seqs = new Map<string, number>();
    for (const e of events) {
      const stepId = e.payload?.step_id;
      if (SETTLED_EVENTS.includes(e.type) && typeof stepId === "string")
        seqs.set(stepId, e.event_seq);
    }
    return seqs;
  }, [events]);

  // A fork belongs to the last step settled at or before its fork point.
  const forksByStep = new Map<string, Execution[]>();
  for (const forkId of branch?.forkIds ?? []) {
    const fork = tree.nodes[forkId];
    let at: string | undefined;
    let atSeq = -1;
    for (const [stepId, seq] of forkSeqs)
      if (seq <= (fork.fork_seq ?? 0) && seq > atSeq)
        [at, atSeq] = [stepId, seq];
    if (at) forksByStep.set(at, [...(forksByStep.get(at) ?? []), fork]);
  }

  if (loading)
    return <div className="p-5 text-sm text-ink-muted">Loading steps…</div>;
  if (error && !branch?.steps)
    return (
      <div className="m-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {error}
        <button
          type="button"
          onClick={() => void store.loadBranch(executionId)}
          className="ml-3 underline"
        >
          Retry
        </button>
      </div>
    );
  const at = (s: Step) => s.started_at ?? s.completed_at ?? "9999";
  const ordered = [...steps].sort((a, b) => at(a).localeCompare(at(b)));

  return (
    <div className="divide-y divide-line">
      {error && (
        <p
          className="px-5 py-3 text-xs text-red-600 dark:text-red-400"
          role="status"
        >
          Steps could not refresh: {error}
        </p>
      )}
      {branch?.error && (
        <p className="px-5 py-3 text-xs text-ink-muted" role="status">
          Subagent links unavailable: {branch.error}
        </p>
      )}
      {branch?.nextCursor && (
        <div className="px-5 py-3 text-xs text-ink-muted">
          More subagents are available.{" "}
          <button
            type="button"
            onClick={() => void store.loadBranch(executionId, true)}
            disabled={branch.loading}
            className="text-accent underline disabled:opacity-50"
          >
            Load more subagents
          </button>
        </div>
      )}
      {requestedStep &&
        !steps.some((step) => step.step_id === requestedStep) && (
          <p className="px-5 py-3 text-xs text-ink-muted">
            The requested parent step is unavailable.
          </p>
        )}
      {steps.length === 0 && (
        <div className="m-5 empty-state">No steps have been submitted yet.</div>
      )}
      {ordered.map((step, i) => {
        const forkSeq = forkSeqs.get(step.step_id);
        const forking = forkingStep === step.step_id;
        const child = branch?.ids
          .map((id) => tree.nodes[id])
          .find((node) => node.spawned_by?.step_id === step.step_id);
        return (
          <article
            key={step.step_id}
            id={`step-${step.step_id}`}
            tabIndex={-1}
            className={`px-5 py-4 md:px-6 ${requestedStep === step.step_id ? "bg-accent-wash" : ""}`}
          >
            <div className="mb-2 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-line font-mono text-[10px] tabular-nums text-ink-muted">
                  {i + 1}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-ink-muted">
                  {step.kind}
                </span>
                <span className="truncate text-sm font-medium text-ink">
                  {step.target}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                {step.started_at && (
                  <span className="hidden text-[11px] tabular-nums text-ink-muted sm:inline">
                    {new Date(step.started_at).toLocaleTimeString()}
                  </span>
                )}
                {forkSeq != null && (
                  <button
                    type="button"
                    onClick={() =>
                      setForkingStep(forking ? null : step.step_id)
                    }
                    aria-expanded={forking}
                    title={`Fork from event ${forkSeq}`}
                    className="rounded-md border border-line-strong bg-surface px-2 py-1 text-[11px] font-medium leading-none text-ink-soft transition-colors hover:border-ink-faint hover:text-ink aria-expanded:border-accent aria-expanded:text-accent"
                  >
                    Fork
                  </button>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium leading-none ${
                    STEP_STATUS_STYLES[step.status] ??
                    STEP_STATUS_STYLES.proposed
                  }`}
                >
                  <span className="h-1 w-1 rounded-full bg-current opacity-75" />
                  {step.status.replaceAll("_", " ")}
                </span>
              </div>
            </div>
            <div className="mb-2 ml-7 truncate font-mono text-[10px] text-ink-faint">
              {step.step_id} · occurrence {step.occurrence}
            </div>
            <div className="ml-7 space-y-1.5">
              {child && (
                <div className="mb-3 rounded-md border border-line bg-surface-muted px-3 py-2.5">
                  <Link
                    replace={treeMode}
                    href={executionHref(child.id, { tree: treeMode })}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs text-accent hover:underline"
                  >
                    <span>
                      View subagent ·{" "}
                      <span className="font-medium">
                        {executionLabel(child)}
                      </span>{" "}
                      <code className="ml-1 text-[10px] text-ink-muted">
                        {child.id.slice(-8)}
                      </code>{" "}
                      <span aria-hidden="true">↗</span>
                    </span>
                    <StatusBadge status={child.status} />
                  </Link>
                  {isTerminal(child) && step.status === "executing" && (
                    <p className="mt-1.5 text-xs text-ink-muted">
                      Result pending in parent step.
                    </p>
                  )}
                </div>
              )}
              {forksByStep.get(step.step_id)?.map((fork) => (
                <Link
                  key={fork.id}
                  href={executionHref(fork.id, { tree: treeMode })}
                  className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-xs text-accent hover:underline"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <BranchIcon className="h-3.5 w-3.5" />
                    Forked after this step
                    {fork.fork_seq != null && ` · event ${fork.fork_seq}`}{" "}
                    <code className="ml-1 text-[10px] text-ink-muted">
                      {fork.id.slice(-8)}
                    </code>{" "}
                    <span aria-hidden="true">↗</span>
                  </span>
                  <StatusBadge status={fork.status} />
                </Link>
              ))}
              <JsonBlock label="Args" value={step.args} />
              <JsonBlock label="Result" value={step.result} />
              <JsonBlock label="Error" value={step.error} />
              {forking && forkSeq != null && (
                <ForkForm
                  executionId={executionId}
                  atSeq={forkSeq}
                  onCancel={() => setForkingStep(null)}
                />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
