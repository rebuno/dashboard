"use client";

import { useCallback, useState } from "react";
import { listSteps, type Step } from "@/lib/api";
import { usePolling } from "@/lib/hooks";
import { EXECUTION_DETAIL_POLL_INTERVAL } from "@/lib/constants";
import JsonBlock from "@/components/JsonBlock";

const STEP_STATUS_STYLES: Record<string, string> = {
  proposed: "bg-gray-100 text-gray-700",
  allowed: "bg-blue-100 text-blue-700",
  denied: "bg-red-100 text-red-700",
  awaiting_approval: "bg-amber-100 text-amber-700",
  executing: "bg-blue-100 text-blue-700",
  succeeded: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function StepsPanel({ executionId }: { executionId: string }) {
  const [steps, setSteps] = useState<Step[]>([]);
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

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading steps…</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (steps.length === 0) return <div className="p-4 text-sm text-gray-400">No steps yet</div>;

  const ordered = [...steps].sort((a, b) =>
    (a.started_at ?? "9999").localeCompare(b.started_at ?? "9999")
  );

  return (
    <div className="divide-y divide-gray-100">
      {ordered.map((step) => (
        <div key={step.step_id} className="px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-500">{step.kind}</span>
              <span className="text-sm font-medium">{step.target}</span>
            </div>
            <div className="flex items-center gap-2">
              {step.started_at && (
                <span className="text-xs text-gray-400">
                  {new Date(step.started_at).toLocaleTimeString()}
                </span>
              )}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${
                  STEP_STATUS_STYLES[step.status] ?? STEP_STATUS_STYLES.proposed
                }`}
              >
                {step.status}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-400 mb-1">
            step_id: <code>{step.step_id}</code> · occurrence {step.occurrence}
          </div>
          <div className="space-y-1">
            <JsonBlock label="Args" value={step.args} />
            <JsonBlock label="Result" value={step.result} />
            <JsonBlock label="Error" value={step.error} />
          </div>
        </div>
      ))}
    </div>
  );
}
