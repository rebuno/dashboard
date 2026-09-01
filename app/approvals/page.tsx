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
    <div className="p-6 max-w-3xl mx-auto w-full space-y-4">
      <h1 className="text-lg font-semibold">Approvals</h1>
      {loading && (
        <p className="text-sm text-gray-400 dark:text-gray-400">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {!loading && !error && approvals.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-400">
          No pending approvals
        </p>
      )}
      <div className="space-y-3">
        {approvals.map((a) => (
          <ApprovalCard key={a.id} approval={a} onDecided={load} />
        ))}
      </div>
    </div>
  );
}
