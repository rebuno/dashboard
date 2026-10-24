"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { type Execution, listExecutions } from "@/lib/api";

export default function PolicyExecutionPicker({
  agentId,
  value,
  onChange,
}: {
  agentId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const [page, setPage] = useState<{
    agentId: string;
    executions: Execution[];
    nextCursor?: string;
  }>({ agentId, executions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedCursor, setFailedCursor] = useState<string | undefined>();
  const request = useRef<AbortController | null>(null);
  const previousAgent = useRef(agentId);
  const selection = useRef(value);
  const notifyChange = useRef(onChange);

  useEffect(() => {
    selection.current = value;
    notifyChange.current = onChange;
  }, [value, onChange]);

  const load = useCallback(
    async (cursor?: string) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      setError(null);
      setFailedCursor(undefined);
      try {
        const result = await listExecutions(
          { agent_id: agentId, limit: 50, cursor },
          controller.signal,
        );
        if (controller.signal.aborted || request.current !== controller) return;
        setPage((previous) => {
          const existing =
            previous.agentId === agentId ? previous.executions : [];
          const selected = existing.find(
            (item) => item.id === selection.current,
          );
          const executions = new Map(
            (cursor ? existing : selected ? [selected] : []).map((item) => [
              item.id,
              item,
            ]),
          );
          for (const item of result.executions) executions.set(item.id, item);
          return {
            agentId,
            executions: [...executions.values()],
            nextCursor: result.next_cursor,
          };
        });
      } catch (cause) {
        if (controller.signal.aborted || request.current !== controller) return;
        setError(
          cause instanceof Error ? cause.message : "Failed to load executions",
        );
        setFailedCursor(cursor);
      } finally {
        if (!controller.signal.aborted && request.current === controller) {
          setLoading(false);
        }
      }
    },
    [agentId],
  );

  useEffect(() => {
    if (previousAgent.current !== agentId) {
      previousAgent.current = agentId;
      selection.current = "";
      notifyChange.current("");
    }
    setPage({ agentId, executions: [] });
    void load();
    return () => request.current?.abort();
  }, [agentId, load]);

  const current = page.agentId === agentId;
  const executions = current ? page.executions : [];
  const selectedValue = current ? value : "";
  const missingSelection =
    selectedValue && !executions.some((item) => item.id === selectedValue);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-ink-muted">
          Execution
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="button-secondary min-h-7 px-2 py-1 text-xs"
        >
          Refresh
        </button>
      </div>
      <select
        id={id}
        value={selectedValue}
        onChange={(event) => {
          selection.current = event.target.value;
          onChange(event.target.value);
        }}
        disabled={!executions.length && !selectedValue}
        aria-describedby={`${id}-status`}
        className="field-control w-full min-w-0 px-2.5 py-1.5 text-xs"
      >
        <option value="">Select an execution</option>
        {missingSelection && (
          <option value={selectedValue}>{selectedValue} · selected</option>
        )}
        {executions.map((execution) => (
          <option key={execution.id} value={execution.id}>
            {execution.id} · {execution.status.replaceAll("_", " ")} ·{" "}
            {new Date(execution.created_at).toLocaleString()}
          </option>
        ))}
      </select>
      <p id={`${id}-status`} role="status" className="text-xs text-ink-muted">
        {loading
          ? "Loading executions…"
          : !error && !executions.length
            ? "No executions found for this agent."
            : "Replay evaluates recorded steps without executing them."}
      </p>
      {error && current && (
        <div className="flex items-center gap-3">
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load(failedCursor)}
            disabled={loading}
            className="button-secondary min-h-7 shrink-0 px-2 py-1 text-xs"
          >
            Retry
          </button>
        </div>
      )}
      {current && page.nextCursor && !error && (
        <button
          type="button"
          onClick={() => void load(page.nextCursor)}
          disabled={loading}
          className="button-secondary min-h-7 px-2 py-1 text-xs"
        >
          Load more
        </button>
      )}
    </div>
  );
}
