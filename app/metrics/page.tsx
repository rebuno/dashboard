"use client";

import { useCallback, useRef, useState } from "react";
import BreakdownBars from "@/components/metrics/BreakdownBars";
import CounterCard from "@/components/metrics/CounterCard";
import QuantileCard from "@/components/metrics/QuantileCard";
import { METRICS_POLL_INTERVAL, METRICS_RANGES } from "@/lib/constants";
import { usePolling } from "@/lib/hooks";

interface MetricsResponse {
  source: "prometheus" | "kernel";
  range: string | null;
  counters: Record<string, number | null>;
  gauges: { queueDepth: number | null };
  breakdowns: Record<string, Record<string, number>>;
  quantiles: Record<
    string,
    { p50: number | null; p95: number | null; p99: number | null }
  >;
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
      if (!resp.ok)
        throw new Error(body.error || `Metrics fetch failed: ${resp.status}`);
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
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Metrics</h1>
          <p className="page-description">
            Runtime volume, outcomes, and latency from the kernel.
          </p>
        </div>
        {data?.source === "kernel" ? (
          <span
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted"
            title="PROMETHEUS_URL is not configured"
          >
            Kernel · since start
          </span>
        ) : (
          <div className="flex rounded-lg border border-line bg-surface p-1">
            {METRICS_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => selectRange(r)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  r === range
                    ? "bg-accent-wash text-accent"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </header>

      {loading && (
        <div className="text-sm text-ink-muted">Loading metrics…</div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
              Overview
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <CounterCard
                label="Executions created"
                value={data.counters.executionsCreated}
              />
              <CounterCard
                label="Queue depth"
                value={data.gauges.queueDepth}
                current
              />
              <CounterCard
                label="Dispatches reclaimed"
                value={data.counters.dispatchesReclaimed}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
              Activity
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              <BreakdownBars
                label="Executions completed"
                data={data.breakdowns.executionsCompleted ?? {}}
              />
              <BreakdownBars
                label="Steps submitted"
                data={data.breakdowns.stepsSubmitted ?? {}}
              />
              <BreakdownBars
                label="Replay"
                data={data.breakdowns.replay ?? {}}
              />
              <BreakdownBars
                label="Dispatch outcomes"
                data={data.breakdowns.dispatchOutcomes ?? {}}
              />
              <BreakdownBars
                label="Policy decisions"
                data={data.breakdowns.policyDecisions ?? {}}
              />
              <BreakdownBars
                label="Approval outcomes"
                data={data.breakdowns.approvalOutcomes ?? {}}
              />
              <BreakdownBars
                label="Rate limit"
                data={data.breakdowns.rateLimit ?? {}}
              />
              <BreakdownBars
                label="Worker errors"
                data={data.breakdowns.workerErrors ?? {}}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
              Latency
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              <QuantileCard
                label="Dispatch latency"
                {...(data.quantiles.dispatchLatency ?? EMPTY_QUANTILES)}
              />
              <QuantileCard
                label="Policy evaluation latency"
                {...(data.quantiles.policyLatency ?? EMPTY_QUANTILES)}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
