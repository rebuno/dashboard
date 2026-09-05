import { NextRequest, NextResponse } from "next/server";
import { METRICS_RANGES } from "@/lib/constants";
import {
  groupByLabel,
  histogramQuantile,
  parsePrometheusText,
  singleValue,
} from "@/lib/prometheus";

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || "";
const REBUNO_URL = process.env.REBUNO_URL || "http://localhost:8080";
const REBUNO_API_KEY = process.env.REBUNO_API_KEY || "";

const COUNTERS: Record<string, string> = {
  executionsCreated: "rebuno_executions_created_total",
  dispatchesReclaimed: "rebuno_dispatches_reclaimed_total",
};

const BREAKDOWNS: Record<string, [metric: string, label: string]> = {
  executionsCompleted: ["rebuno_executions_completed_total", "status"],
  stepsSubmitted: ["rebuno_steps_submitted_total", "kind"],
  replay: ["rebuno_replay_total", "hit"],
  dispatchOutcomes: ["rebuno_dispatch_outcomes_total", "outcome"],
  policyDecisions: ["rebuno_policy_decisions_total", "decision"],
  approvalOutcomes: ["rebuno_approval_outcomes_total", "outcome"],
  rateLimit: ["rebuno_rate_limit_decisions_total", "outcome"],
  workerErrors: ["rebuno_worker_errors_total", "worker"],
};

const HISTOGRAMS: Record<string, string> = {
  dispatchLatency: "rebuno_dispatch_latency_seconds",
  policyLatency: "rebuno_policy_latency_seconds",
};

const QUANTILES = [0.5, 0.95, 0.99] as const;

interface VectorResult {
  metric: Record<string, string>;
  value: [number, string];
}

async function query(expr: string): Promise<VectorResult[]> {
  const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(expr)}`;
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`Prometheus ${resp.status} for: ${expr}`);
  const body = await resp.json();
  if (body.status !== "success")
    throw new Error(body.error || "Prometheus query failed");
  return body.data.result ?? [];
}

function scalar(result: VectorResult[]): number | null {
  if (result.length === 0) return null;
  const v = parseFloat(result[0].value[1]);
  return Number.isNaN(v) ? null : v;
}

// Without Prometheus, scrape the kernel's in-memory counters instead: cumulative
// since kernel start, with no time range, which `source` tells the page.
async function fromKernel() {
  const headers: Record<string, string> = {};
  if (REBUNO_API_KEY) headers["Authorization"] = `Bearer ${REBUNO_API_KEY}`;

  const resp = await fetch(`${REBUNO_URL}/metrics`, {
    headers,
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Kernel /metrics returned ${resp.status}`);
  const samples = parsePrometheusText(await resp.text());

  const counters: Record<string, number | null> = {};
  for (const [k, metric] of Object.entries(COUNTERS))
    counters[k] = singleValue(samples, metric);

  const breakdowns: Record<string, Record<string, number>> = {};
  for (const [k, [metric, label]] of Object.entries(BREAKDOWNS)) {
    breakdowns[k] = groupByLabel(samples, metric, label);
  }

  const quantiles: Record<string, Record<string, number | null>> = {};
  for (const [k, metric] of Object.entries(HISTOGRAMS)) {
    const [p50, p95, p99] = QUANTILES.map((q) =>
      histogramQuantile(samples, metric, q),
    );
    quantiles[k] = { p50, p95, p99 };
  }

  return {
    source: "kernel" as const,
    range: null,
    counters,
    gauges: { queueDepth: singleValue(samples, "rebuno_queue_depth") },
    breakdowns,
    quantiles,
  };
}

export async function GET(req: NextRequest) {
  if (!PROMETHEUS_URL) {
    try {
      return NextResponse.json(await fromKernel());
    } catch (err) {
      console.error("Failed to scrape kernel /metrics", err);
      return NextResponse.json(
        { error: "Kernel unavailable" },
        { status: 502 },
      );
    }
  }

  const range = req.nextUrl.searchParams.get("range") ?? "24h";
  if (!METRICS_RANGES.includes(range)) {
    return NextResponse.json(
      { error: `Unsupported range: ${range}` },
      { status: 400 },
    );
  }

  try {
    const counterKeys = Object.keys(COUNTERS);
    const breakdownKeys = Object.keys(BREAKDOWNS);
    const histogramKeys = Object.keys(HISTOGRAMS);

    const [counterResults, queueDepth, breakdownResults, histogramResults] =
      await Promise.all([
        Promise.all(
          counterKeys.map((k) =>
            query(`sum(increase(${COUNTERS[k]}[${range}]))`),
          ),
        ),
        query("rebuno_queue_depth"),
        Promise.all(
          breakdownKeys.map((k) => {
            const [metric, label] = BREAKDOWNS[k];
            return query(`sum by (${label}) (increase(${metric}[${range}]))`);
          }),
        ),
        Promise.all(
          histogramKeys.flatMap((k) =>
            QUANTILES.map((q) =>
              query(
                `histogram_quantile(${q}, sum by (le) (rate(${HISTOGRAMS[k]}_bucket[${range}])))`,
              ),
            ),
          ),
        ),
      ]);

    const counters: Record<string, number | null> = {};
    counterKeys.forEach((k, i) => {
      const v = scalar(counterResults[i]);
      counters[k] = v == null ? null : Math.round(v);
    });

    const breakdowns: Record<string, Record<string, number>> = {};
    breakdownKeys.forEach((k, i) => {
      const [, label] = BREAKDOWNS[k];
      const entries: Record<string, number> = {};
      for (const r of breakdownResults[i]) {
        const v = parseFloat(r.value[1]);
        if (!Number.isNaN(v))
          entries[r.metric[label] ?? "unknown"] = Math.round(v);
      }
      breakdowns[k] = entries;
    });

    const quantiles: Record<string, Record<string, number | null>> = {};
    histogramKeys.forEach((k, i) => {
      const [p50, p95, p99] = QUANTILES.map((_, qi) =>
        scalar(histogramResults[i * QUANTILES.length + qi]),
      );
      quantiles[k] = { p50, p95, p99 };
    });

    return NextResponse.json({
      source: "prometheus" as const,
      range,
      counters,
      gauges: { queueDepth: scalar(queueDepth) },
      breakdowns,
      quantiles,
    });
  } catch (err) {
    console.error("Failed to query Prometheus", err);
    return NextResponse.json(
      { error: "Metrics backend unavailable" },
      { status: 502 },
    );
  }
}
