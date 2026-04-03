"use client";

import { useEffect, useState, useCallback } from "react";
import { METRICS_POLL_INTERVAL } from "@/lib/constants";
import {
  fetchActiveExecutions,
  fetchActiveExecutionsSeries,
  fetchExecutionTotals,
  fetchIntentTotals,
  fetchStepDurationPercentiles,
  fetchPolicyEvalPercentiles,
  type TimeSeriesPoint,
  type LabeledSeries,
} from "@/lib/prometheus";

import ActiveExecutionsPanel from "./metrics/ActiveExecutionsPanel";
import ExecutionsTotalPanel from "./metrics/ExecutionsTotalPanel";
import IntentsTotalPanel from "./metrics/IntentsTotalPanel";
import StepDurationPanel from "./metrics/StepDurationPanel";
import PolicyEvalPanel from "./metrics/PolicyEvalPanel";

interface TimeRange {
  label: string;
  seconds: number;
}

interface Resolution {
  label: string;
  seconds: number;
}

const TIME_RANGES: TimeRange[] = [
  { label: "15m", seconds: 15 * 60 },
  { label: "1h", seconds: 60 * 60 },
  { label: "6h", seconds: 6 * 60 * 60 },
  { label: "1d", seconds: 24 * 60 * 60 },
  { label: "1w", seconds: 7 * 24 * 60 * 60 },
  { label: "1mo", seconds: 30 * 24 * 60 * 60 },
];

const RESOLUTIONS: Resolution[] = [
  { label: "Auto", seconds: 0 },
  { label: "1m", seconds: 60 },
  { label: "15m", seconds: 15 * 60 },
  { label: "1h", seconds: 60 * 60 },
  { label: "1d", seconds: 24 * 60 * 60 },
];

interface MetricsData {
  activeExec: number;
  activeExecSeries: { time: number; value: number }[];
  execTotals: Record<string, number>;
  execSeries: TimeSeriesPoint[];
  intentTotals: Record<string, number>;
  intentSeries: TimeSeriesPoint[];
  stepDuration: { p50: LabeledSeries[]; p95: LabeledSeries[]; p99: LabeledSeries[] };
  policyEval: { p50: LabeledSeries[]; p95: LabeledSeries[]; p99: LabeledSeries[] };
}

export default function MetricsDashboard() {
  const [timeRange, setTimeRange] = useState(TIME_RANGES[0]);
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const step = resolution.seconds || undefined;
    try {
      const [activeExec, activeExecSeries, execData, intentData, stepDuration, policyEval] =
        await Promise.all([
          fetchActiveExecutions(),
          fetchActiveExecutionsSeries(timeRange.seconds, step),
          fetchExecutionTotals(timeRange.seconds, step),
          fetchIntentTotals(timeRange.seconds, step),
          fetchStepDurationPercentiles(timeRange.seconds, step),
          fetchPolicyEvalPercentiles(timeRange.seconds, step),
        ]);

      setData({
        activeExec,
        activeExecSeries,
        execTotals: execData.totals,
        execSeries: execData.series,
        intentTotals: intentData.totals,
        intentSeries: intentData.series,
        stepDuration,
        policyEval,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch metrics");
      console.error("Metrics fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [timeRange, resolution]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, METRICS_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-accent rounded-full animate-pulse" />
            <div className="w-1 h-1 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
            <div className="w-1 h-1 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
          </div>
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">
            Loading metrics
          </span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[11px] font-mono text-phosphor-red mb-3">{error}</p>
          <button onClick={load} className="btn-secondary text-[10px]">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface-0 animate-fade-in">
      <div className="h-11 px-4 border-b border-border bg-surface-1/50 flex items-center justify-between shrink-0">
        <h2 className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.2em]">
          Metrics
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest mr-1">Range</span>
            {TIME_RANGES.map((range) => (
              <button
                key={range.label}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-all duration-150 ${
                  timeRange.label === range.label
                    ? "bg-surface-2 text-gray-200"
                    : "text-gray-600 hover:text-gray-400 hover:bg-surface-2/50"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          <div className="h-3 w-px bg-border" />

          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest mr-1">Step</span>
            {RESOLUTIONS.map((res) => (
              <button
                key={res.label}
                onClick={() => setResolution(res)}
                className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-all duration-150 ${
                  resolution.label === res.label
                    ? "bg-surface-2 text-gray-200"
                    : "text-gray-600 hover:text-gray-400 hover:bg-surface-2/50"
                }`}
              >
                {res.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ActiveExecutionsPanel
            value={data?.activeExec ?? 0}
            series={data?.activeExecSeries ?? []}
          />
          <ExecutionsTotalPanel totals={data?.execTotals ?? {}} data={data?.execSeries ?? []} />
          <IntentsTotalPanel totals={data?.intentTotals ?? {}} data={data?.intentSeries ?? []} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <StepDurationPanel
            p50={data?.stepDuration.p50 ?? []}
            p95={data?.stepDuration.p95 ?? []}
            p99={data?.stepDuration.p99 ?? []}
          />
          <PolicyEvalPanel
            p50={data?.policyEval.p50 ?? []}
            p95={data?.policyEval.p95 ?? []}
            p99={data?.policyEval.p99 ?? []}
          />
        </div>
      </div>
    </div>
  );
}
