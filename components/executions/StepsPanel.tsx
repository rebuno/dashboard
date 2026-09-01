"use client";

import { useCallback, useState } from "react";
import JsonBlock from "@/components/JsonBlock";
import { listSteps, type Step } from "@/lib/api";
import { EXECUTION_DETAIL_POLL_INTERVAL } from "@/lib/constants";
import { usePolling } from "@/lib/hooks";

const STEP_STATUS_STYLES: Record<string, string> = {
  proposed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  allowed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  denied: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  awaiting_approval:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  executing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  succeeded:
    "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
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

  if (loading)
    return (
      <div className="p-4 text-sm text-gray-400 dark:text-gray-400">
        Loading steps…
      </div>
    );
  if (error)
    return (
      <div className="p-4 text-sm text-red-600 dark:text-red-400">{error}</div>
    );
  if (steps.length === 0)
    return (
      <div className="p-4 text-sm text-gray-400 dark:text-gray-400">
        No steps yet
      </div>
    );

  const ordered = [...steps].sort((a, b) =>
    (a.started_at ?? "9999").localeCompare(b.started_at ?? "9999"),
  );

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {ordered.map((step, i) => (
        <div key={step.step_id} className="px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400 tabular-nums dark:text-gray-400">
                {i + 1}
              </span>
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                {step.kind}
              </span>
              <span className="text-sm font-medium">{step.target}</span>
            </div>
            <div className="flex items-center gap-2">
              {step.started_at && (
                <span className="text-xs text-gray-400 dark:text-gray-400">
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
          <div className="text-xs text-gray-400 mb-1 dark:text-gray-400">
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
