"use client";

import { useCallback, useMemo, useState } from "react";
import ForkForm from "@/components/executions/ForkForm";
import JsonBlock from "@/components/JsonBlock";
import { type Event, listSteps, type Step } from "@/lib/api";
import { EXECUTION_DETAIL_POLL_INTERVAL } from "@/lib/constants";
import { usePolling } from "@/lib/hooks";

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
  const [steps, setSteps] = useState<Step[]>([]);
  const [forkingStep, setForkingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setSteps(await listSteps(executionId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load steps");
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  usePolling(load, EXECUTION_DETAIL_POLL_INTERVAL, [executionId]);

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

  if (loading)
    return <div className="p-5 text-sm text-ink-muted">Loading steps…</div>;
  if (error)
    return (
      <div className="m-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {error}
      </div>
    );
  if (steps.length === 0)
    return (
      <div className="m-5 empty-state">No steps have been submitted yet.</div>
    );

  const at = (s: Step) => s.started_at ?? s.completed_at ?? "9999";
  const ordered = [...steps].sort((a, b) => at(a).localeCompare(at(b)));

  return (
    <div className="divide-y divide-line">
      {ordered.map((step, i) => {
        const forkSeq = forkSeqs.get(step.step_id);
        const forking = forkingStep === step.step_id;
        return (
          <article key={step.step_id} className="px-5 py-4 md:px-6">
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
