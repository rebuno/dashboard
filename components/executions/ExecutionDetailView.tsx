"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import EventsPanel from "@/components/executions/EventsPanel";
import StepsPanel from "@/components/executions/StepsPanel";
import JsonBlock from "@/components/JsonBlock";
import StatusBadge from "@/components/StatusBadge";
import {
  cancelExecution,
  type Execution,
  getEvents,
  getExecution,
} from "@/lib/api";
import { EXECUTION_DETAIL_POLL_INTERVAL } from "@/lib/constants";
import { usePolling } from "@/lib/hooks";

export default function ExecutionDetailView({
  executionId,
}: {
  executionId: string;
}) {
  const [execution, setExecution] = useState<Execution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"steps" | "events">("steps");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const lastSeq = useRef(0);

  useEffect(() => {
    lastSeq.current = 0;
    setLastEventAt(null);
  }, [executionId]);

  const load = useCallback(async () => {
    try {
      setExecution(await getExecution(executionId));
      const batch = await getEvents(executionId, lastSeq.current);
      if (batch.length > 0) {
        lastSeq.current = Math.max(
          lastSeq.current,
          ...batch.map((e) => e.event_seq),
        );
        setLastEventAt(batch[batch.length - 1].occurred_at);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load execution");
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  usePolling(load, EXECUTION_DETAIL_POLL_INTERVAL, [executionId]);

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelExecution(executionId);
      await load();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  }

  if (loading)
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-ink-muted">
        Loading execution…
      </div>
    );
  if (error)
    return (
      <div className="m-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {error}
      </div>
    );
  if (!execution) return null;

  const isTerminal = ["completed", "failed", "cancelled"].includes(
    execution.status,
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-line px-5 py-5 md:px-6">
        <Link
          href="/executions"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink md:hidden"
        >
          <span aria-hidden="true">←</span> All executions
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em]">
                {execution.agent_id}
              </h1>
              <StatusBadge status={execution.status} />
            </div>
            <code className="mt-1.5 block truncate text-[11px] text-ink-muted">
              {execution.id}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isTerminal || cancelling}
            className="button-danger shrink-0"
          >
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-muted">
          <span>Created {new Date(execution.created_at).toLocaleString()}</span>
          <span>
            Updated{" "}
            {new Date(
              lastEventAt &&
                Date.parse(lastEventAt) > Date.parse(execution.updated_at)
                ? lastEventAt
                : execution.updated_at,
            ).toLocaleString()}
          </span>
          {execution.deadline_at && (
            <span>
              Deadline {new Date(execution.deadline_at).toLocaleString()}
            </span>
          )}
        </div>
        {execution.failure_reason && (
          <p
            className={`mt-3 rounded-md border px-3 py-2 text-xs ${
              execution.status === "cancelled"
                ? "border-line bg-surface-muted text-ink-muted"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            <span className="font-medium">
              {execution.status === "cancelled" ? "Reason:" : "Failure:"}
            </span>{" "}
            {execution.failure_reason}
          </p>
        )}
        {cancelError && (
          <div
            className="mt-3 text-xs text-red-600 dark:text-red-400"
            role="alert"
          >
            {cancelError}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <JsonBlock label="Input" value={execution.input} />
          <JsonBlock label="Output" value={execution.output} />
        </div>
      </header>
      <div
        className="flex gap-5 border-b border-line px-5 md:px-6"
        role="tablist"
      >
        {(["steps", "events"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            role="tab"
            aria-selected={tab === t}
            className={`relative py-3 text-sm font-medium transition-colors ${
              tab === t
                ? "text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t === "steps" ? "Steps" : "Events"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "steps" ? (
          <StepsPanel key={executionId} executionId={executionId} />
        ) : (
          <EventsPanel key={executionId} executionId={executionId} />
        )}
      </div>
    </div>
  );
}
