"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import CreateExecutionForm from "@/components/executions/CreateExecutionForm";
import StatusBadge from "@/components/StatusBadge";
import { type Execution, listExecutions } from "@/lib/api";
import { EXECUTION_LIST_POLL_INTERVAL } from "@/lib/constants";
import { usePolling } from "@/lib/hooks";

const STATUS_OPTIONS = [
  "",
  "pending",
  "running",
  "blocked",
  "completed",
  "failed",
  "cancelled",
];

export default function ExecutionListPanel() {
  const pathname = usePathname();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = useCallback(async () => {
    try {
      const page = await listExecutions(
        statusFilter ? { status: statusFilter } : undefined,
      );
      setExecutions(page.executions);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load executions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  usePolling(load, EXECUTION_LIST_POLL_INTERVAL, [statusFilter, refreshNonce]);

  const hasSelection = pathname !== "/executions";

  return (
    <section
      className={`${
        hasSelection ? "hidden md:flex" : "flex"
      } h-full min-h-0 w-full shrink-0 flex-col border-line bg-surface md:w-[22rem] md:border-r`}
      aria-label="Executions"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4">
        <div>
          <h1 className="text-base font-semibold tracking-[-0.015em]">
            Executions
          </h1>
          <p className="mt-0.5 text-xs text-ink-muted">
            {loading ? "Loading runs" : `${executions.length} shown`}
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setLoading(true);
            setStatusFilter(e.target.value);
          }}
          aria-label="Filter executions by status"
          className="field-control h-8 min-h-0 px-2.5 text-xs"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s || "All"}
            </option>
          ))}
        </select>
      </div>
      <CreateExecutionForm onCreated={() => setRefreshNonce((n) => n + 1)} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && <div className="p-5 text-sm text-ink-muted">Loading…</div>}
        {error && (
          <div className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
        {!loading && !error && executions.length === 0 && (
          <div className="m-4 rounded-lg border border-dashed border-line-strong px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink-soft">No executions</p>
            <p className="mt-1 text-xs text-ink-muted">
              Create a run or change the status filter.
            </p>
          </div>
        )}
        {executions.map((exec) => {
          const active = pathname === `/executions/${exec.id}`;
          return (
            <Link
              key={exec.id}
              href={`/executions/${exec.id}`}
              className={`relative block border-b border-line px-4 py-3.5 transition-colors ${
                active ? "bg-accent-wash" : "hover:bg-surface-muted"
              }`}
            >
              {active && (
                <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
              )}
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <code className="truncate text-[11px] text-ink-soft">
                  {exec.id}
                </code>
                <StatusBadge status={exec.status} />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                <span className="truncate">{exec.agent_id}</span>
                <span className="shrink-0 tabular-nums">
                  {new Date(exec.created_at).toLocaleTimeString()}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
