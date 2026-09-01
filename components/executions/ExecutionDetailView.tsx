"use client";

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
      <div className="p-6 text-sm text-gray-400 dark:text-gray-400">
        Loading…
      </div>
    );
  if (error)
    return (
      <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
    );
  if (!execution) return null;

  const isTerminal = ["completed", "failed", "cancelled"].includes(
    execution.status,
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-gray-200 space-y-2 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={execution.status} />
            <code className="text-xs text-gray-500 dark:text-gray-400">
              {execution.id}
            </code>
          </div>
          <button
            onClick={handleCancel}
            disabled={isTerminal || cancelling}
            className="border border-red-300 text-red-600 rounded px-3 py-1 text-xs hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          agent:{" "}
          <span className="text-gray-700 dark:text-gray-200">
            {execution.agent_id}
          </span>
          {execution.agent_version && (
            <>
              {" "}
              · version:{" "}
              <span className="text-gray-700 dark:text-gray-200">
                {execution.agent_version}
              </span>
            </>
          )}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-400">
          created {new Date(execution.created_at).toLocaleString()} · updated{" "}
          {new Date(
            lastEventAt &&
              Date.parse(lastEventAt) > Date.parse(execution.updated_at)
              ? lastEventAt
              : execution.updated_at,
          ).toLocaleString()}
          {execution.deadline_at && (
            <> · deadline {new Date(execution.deadline_at).toLocaleString()}</>
          )}
        </div>
        {execution.failure_reason && (
          <div className="text-xs text-red-600 dark:text-red-400">
            failure: {execution.failure_reason}
          </div>
        )}
        {cancelError && (
          <div className="text-xs text-red-600 dark:text-red-400">
            {cancelError}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <JsonBlock label="Input" value={execution.input} />
          <JsonBlock label="Output" value={execution.output} />
        </div>
      </div>
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {(["steps", "events"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-blue-600 text-blue-700 dark:border-blue-500 dark:text-blue-300"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {t === "steps" ? "Steps" : "Events"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === "steps" ? (
          <StepsPanel key={executionId} executionId={executionId} />
        ) : (
          <EventsPanel key={executionId} executionId={executionId} />
        )}
      </div>
    </div>
  );
}
