"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { listExecutions, type Execution } from "@/lib/api";
import { usePolling } from "@/lib/hooks";
import { EXECUTION_LIST_POLL_INTERVAL } from "@/lib/constants";
import StatusBadge from "@/components/StatusBadge";
import CreateExecutionForm from "@/components/executions/CreateExecutionForm";

const STATUS_OPTIONS = ["", "pending", "running", "blocked", "completed", "failed", "cancelled"];

export default function ExecutionListPanel() {
  const pathname = usePathname();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = useCallback(async () => {
    try {
      const page = await listExecutions(statusFilter ? { status: statusFilter } : undefined);
      setExecutions(page.executions);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load executions");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  usePolling(load, EXECUTION_LIST_POLL_INTERVAL, [statusFilter, refreshNonce]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <CreateExecutionForm onCreated={() => setRefreshNonce((n) => n + 1)} />
      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Executions</span>
        <select
          value={statusFilter}
          onChange={(e) => {
            setLoading(true);
            setStatusFilter(e.target.value);
          }}
          className="text-xs border border-gray-300 rounded px-1.5 py-1"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s || "All"}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-sm text-gray-400">Loading…</div>}
        {error && <div className="p-4 text-sm text-red-600">{error}</div>}
        {!loading && !error && executions.length === 0 && (
          <div className="p-4 text-sm text-gray-400">No executions</div>
        )}
        {executions.map((exec) => {
          const active = pathname === `/executions/${exec.id}`;
          return (
            <Link
              key={exec.id}
              href={`/executions/${exec.id}`}
              className={`block px-4 py-3 border-b border-gray-100 ${active ? "bg-blue-50" : "hover:bg-gray-50"}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <code className="text-xs text-gray-600 truncate">{exec.id}</code>
                <StatusBadge status={exec.status} />
              </div>
              <div className="text-xs text-gray-400">
                {exec.agent_id} · {new Date(exec.created_at).toLocaleTimeString()}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
