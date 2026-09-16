"use client";

import { useCallback, useState } from "react";
import ApprovalCard from "@/components/approvals/ApprovalCard";
import { type Approval, listPendingApprovals } from "@/lib/api";
import { APPROVALS_POLL_INTERVAL } from "@/lib/constants";
import { usePolling } from "@/lib/hooks";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await listPendingApprovals();
      data.sort(
        (a, b) =>
          new Date(a.timeout_at).getTime() - new Date(b.timeout_at).getTime(),
      );
      setApprovals(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(load, APPROVALS_POLL_INTERVAL);

  return (
    <div className="page-shell max-w-5xl">
      <header className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-description">
            Review steps paused by policy before they can continue.
          </p>
        </div>
        {!loading && !error && approvals.length > 0 && (
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted">
            {approvals.length} pending
          </span>
        )}
      </header>
      {loading && <p className="text-sm text-ink-muted">Loading approvals…</p>}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {!loading && !error && approvals.length === 0 && (
        <div className="empty-state">
          <div>
            <p className="font-medium text-ink-soft">Queue is clear</p>
            <p className="mt-1 text-xs">No steps are waiting for approval.</p>
          </div>
        </div>
      )}
      <div className="space-y-4">
        {approvals.map((a) => (
          <ApprovalCard key={a.id} approval={a} onDecided={load} />
        ))}
      </div>
    </div>
  );
}
