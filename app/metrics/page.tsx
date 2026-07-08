"use client";

import { useCallback, useState } from "react";
import { parsePrometheusText, groupByLabel, singleValue, histogramQuantile, type Sample } from "@/lib/prometheus";
import { usePolling } from "@/lib/hooks";
import { METRICS_POLL_INTERVAL } from "@/lib/constants";
import CounterCard from "@/components/metrics/CounterCard";
import BreakdownBars from "@/components/metrics/BreakdownBars";
import QuantileCard from "@/components/metrics/QuantileCard";

export default function MetricsPage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const resp = await fetch("/api/metrics");
      if (!resp.ok) throw new Error(`Metrics fetch failed: ${resp.status}`);
      const text = await resp.text();
      setSamples(parsePrometheusText(text));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(load, METRICS_POLL_INTERVAL);

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading metrics…</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto w-full space-y-4">
      <h1 className="text-lg font-semibold">Metrics</h1>
      <div className="grid grid-cols-2 gap-4">
        <CounterCard label="Executions Created" value={singleValue(samples, "rebuno_executions_created_total")} />
        <CounterCard label="Queue Depth" value={singleValue(samples, "rebuno_queue_depth")} />
        <CounterCard
          label="Dispatches Reclaimed"
          value={singleValue(samples, "rebuno_dispatches_reclaimed_total")}
        />
        <BreakdownBars
          label="Executions Completed"
          data={groupByLabel(samples, "rebuno_executions_completed_total", "status")}
        />
        <BreakdownBars label="Steps Submitted" data={groupByLabel(samples, "rebuno_steps_submitted_total", "kind")} />
        <BreakdownBars label="Replay" data={groupByLabel(samples, "rebuno_replay_total", "hit")} />
        <BreakdownBars
          label="Dispatch Outcomes"
          data={groupByLabel(samples, "rebuno_dispatch_outcomes_total", "outcome")}
        />
        <BreakdownBars label="Worker Errors" data={groupByLabel(samples, "rebuno_worker_errors_total", "worker")} />
        <QuantileCard
          label="Dispatch Latency"
          p50={histogramQuantile(samples, "rebuno_dispatch_latency_seconds", 0.5)}
          p95={histogramQuantile(samples, "rebuno_dispatch_latency_seconds", 0.95)}
          p99={histogramQuantile(samples, "rebuno_dispatch_latency_seconds", 0.99)}
        />
        <QuantileCard
          label="Policy Evaluation Latency"
          p50={histogramQuantile(samples, "rebuno_policy_latency_seconds", 0.5)}
          p95={histogramQuantile(samples, "rebuno_policy_latency_seconds", 0.95)}
          p99={histogramQuantile(samples, "rebuno_policy_latency_seconds", 0.99)}
        />
      </div>
    </div>
  );
}
