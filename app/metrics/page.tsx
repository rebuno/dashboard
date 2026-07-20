"use client";

import { useCallback, useRef, useState } from "react";
import { usePolling } from "@/lib/hooks";
import { METRICS_POLL_INTERVAL, METRICS_RANGES } from "@/lib/constants";
import CounterCard from "@/components/metrics/CounterCard";
import BreakdownBars from "@/components/metrics/BreakdownBars";
import QuantileCard from "@/components/metrics/QuantileCard";

interface MetricsResponse {
  source: "prometheus" | "kernel";
  range: string | null;
  counters: Record<string, number | null>;
  gauges: { queueDepth: number | null };
  breakdowns: Record<string, Record<string, number>>;
  quantiles: Record<string, { p50: number | null; p95: number | null; p99: number | null }>;
}

const EMPTY_QUANTILES = { p50: null, p95: null, p99: null };

export default function MetricsPage() {
  const [range, setRange] = useState("24h");
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const requested = useRef(range);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(`/api/metrics/query?range=${range}`);
      const body = await resp.json();
      if (requested.current !== range) return;
      if (!resp.ok) throw new Error(body.error || `Metrics fetch failed: ${resp.status}`);
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  function selectRange(r: string) {
    requested.current = r;
    setRange(r);
  }

  usePolling(load, METRICS_POLL_INTERVAL, [range]);

  return (
    <div className="p-6 max-w-4xl mx-auto w-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Metrics</h1>
        {data?.source === "kernel" ? (
          <span className="text-xs text-gray-500">since kernel start · no PROMETHEUS_URL</span>
        ) : (
          <div className="flex gap-1">
            {METRICS_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => selectRange(r)}
                className={`px-2.5 py-1 text-xs rounded-md border ${
                  r === range
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="text-sm text-gray-400">Loading metrics…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {data && (
        <div className="grid grid-cols-2 gap-4">
          <CounterCard label="Executions Created" value={data.counters.executionsCreated} />
          <CounterCard label="Queue Depth (now)" value={data.gauges.queueDepth} />
          <CounterCard label="Dispatches Reclaimed" value={data.counters.dispatchesReclaimed} />
          <BreakdownBars label="Executions Completed" data={data.breakdowns.executionsCompleted ?? {}} />
          <BreakdownBars label="Steps Submitted" data={data.breakdowns.stepsSubmitted ?? {}} />
          <BreakdownBars label="Replay" data={data.breakdowns.replay ?? {}} />
          <BreakdownBars label="Dispatch Outcomes" data={data.breakdowns.dispatchOutcomes ?? {}} />
          <BreakdownBars label="Policy Decisions" data={data.breakdowns.policyDecisions ?? {}} />
          <BreakdownBars label="Approval Outcomes" data={data.breakdowns.approvalOutcomes ?? {}} />
          <BreakdownBars label="Rate Limit" data={data.breakdowns.rateLimit ?? {}} />
          <BreakdownBars label="Worker Errors" data={data.breakdowns.workerErrors ?? {}} />
          <QuantileCard label="Dispatch Latency" {...(data.quantiles.dispatchLatency ?? EMPTY_QUANTILES)} />
          <QuantileCard label="Policy Evaluation Latency" {...(data.quantiles.policyLatency ?? EMPTY_QUANTILES)} />
        </div>
      )}
    </div>
  );
}
