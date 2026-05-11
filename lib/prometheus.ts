import { sumDeltas } from "./chart-utils";

interface VectorResult {
  metric: Record<string, string>;
  value: [number, string];
}

interface MatrixResult {
  metric: Record<string, string>;
  values: [number, string][];
}

interface PromResponse<T> {
  status: string;
  data: {
    resultType: string;
    result: T[];
  };
}

async function promQuery(query: string): Promise<VectorResult[]> {
  const params = new URLSearchParams({ query });
  const resp = await fetch(`/prom/query?${params}`);
  if (!resp.ok) throw new Error(`Prometheus query failed: ${resp.statusText}`);
  const json: PromResponse<VectorResult> = await resp.json();
  if (json.status !== "success") throw new Error("Prometheus query error");
  return json.data.result;
}

async function promQueryRange(
  query: string,
  start: number,
  end: number,
  step: number
): Promise<MatrixResult[]> {
  const params = new URLSearchParams({
    query,
    start: String(start),
    end: String(end),
    step: String(step),
  });
  const resp = await fetch(`/prom/query_range?${params}`);
  if (!resp.ok) throw new Error(`Prometheus range query failed: ${resp.statusText}`);
  const json: PromResponse<MatrixResult> = await resp.json();
  if (json.status !== "success") throw new Error("Prometheus query error");
  return json.data.result;
}

export interface TimeSeriesPoint {
  time: number;
  [key: string]: number;
}

export interface LabeledSeries {
  label: string;
  data: { time: number; value: number }[];
}

export async function fetchActiveExecutions(): Promise<number> {
  const result = await promQuery("rebuno_active_executions");
  if (result.length === 0) return 0;
  return parseFloat(result[0].value[1]) || 0;
}

function defaultStep(rangeSeconds: number): number {
  return Math.max(15, Math.floor(rangeSeconds / 120));
}

export async function fetchActiveExecutionsSeries(
  rangeSeconds: number,
  stepOverride?: number
): Promise<{ time: number; value: number }[]> {
  const now = Math.floor(Date.now() / 1000);
  const step = stepOverride || defaultStep(rangeSeconds);
  const result = await promQueryRange(
    "rebuno_active_executions",
    now - rangeSeconds,
    now,
    step
  );
  if (result.length === 0) return [];
  return result[0].values.map(([t, v]) => ({ time: t, value: parseFloat(v) || 0 }));
}

export async function fetchExecutionTotals(
  rangeSeconds: number,
  stepOverride?: number
): Promise<{ totals: Record<string, number>; series: TimeSeriesPoint[] }> {
  const now = Math.floor(Date.now() / 1000);
  const step = stepOverride || defaultStep(rangeSeconds);
  // Fetch one extra step before the range so the first delta is accurate
  const result = await promQueryRange(
    "rebuno_executions_total",
    now - rangeSeconds - step,
    now,
    step
  );
  const cumulative = mergeByTime(result, "status");
  const deltas = toDelta(cumulative);
  return {
    totals: sumDeltas(deltas),
    series: deltas,
  };
}

export async function fetchIntentTotals(
  rangeSeconds: number,
  stepOverride?: number
): Promise<{ totals: Record<string, number>; series: TimeSeriesPoint[] }> {
  const now = Math.floor(Date.now() / 1000);
  const step = stepOverride || defaultStep(rangeSeconds);
  // Fetch one extra step before the range so the first delta is accurate
  const result = await promQueryRange(
    "rebuno_intents_total",
    now - rangeSeconds - step,
    now,
    step
  );
  const cumulative = mergeByTime(result, "decision");
  const deltas = toDelta(cumulative);
  return {
    totals: sumDeltas(deltas),
    series: deltas,
  };
}

export async function fetchStepDurationPercentiles(
  rangeSeconds: number,
  stepOverride?: number
): Promise<{ p50: LabeledSeries[]; p95: LabeledSeries[]; p99: LabeledSeries[] }> {
  const now = Math.floor(Date.now() / 1000);
  const step = stepOverride || defaultStep(rangeSeconds);

  const [p50, p95, p99] = await Promise.all([
    promQueryRange(
      "histogram_quantile(0.5, rate(rebuno_step_duration_seconds_bucket[5m]))",
      now - rangeSeconds,
      now,
      step
    ),
    promQueryRange(
      "histogram_quantile(0.95, rate(rebuno_step_duration_seconds_bucket[5m]))",
      now - rangeSeconds,
      now,
      step
    ),
    promQueryRange(
      "histogram_quantile(0.99, rate(rebuno_step_duration_seconds_bucket[5m]))",
      now - rangeSeconds,
      now,
      step
    ),
  ]);

  return {
    p50: matrixToLabeledSeries(p50, "tool_id"),
    p95: matrixToLabeledSeries(p95, "tool_id"),
    p99: matrixToLabeledSeries(p99, "tool_id"),
  };
}

export async function fetchPolicyEvalPercentiles(
  rangeSeconds: number,
  stepOverride?: number
): Promise<{ p50: LabeledSeries[]; p95: LabeledSeries[]; p99: LabeledSeries[] }> {
  const now = Math.floor(Date.now() / 1000);
  const step = stepOverride || defaultStep(rangeSeconds);

  const [p50, p95, p99] = await Promise.all([
    promQueryRange(
      "histogram_quantile(0.5, rate(rebuno_policy_eval_seconds_bucket[5m]))",
      now - rangeSeconds,
      now,
      step
    ),
    promQueryRange(
      "histogram_quantile(0.95, rate(rebuno_policy_eval_seconds_bucket[5m]))",
      now - rangeSeconds,
      now,
      step
    ),
    promQueryRange(
      "histogram_quantile(0.99, rate(rebuno_policy_eval_seconds_bucket[5m]))",
      now - rangeSeconds,
      now,
      step
    ),
  ]);

  return {
    p50: matrixToLabeledSeries(p50, "action"),
    p95: matrixToLabeledSeries(p95, "action"),
    p99: matrixToLabeledSeries(p99, "action"),
  };
}

function mergeByTime(
  series: MatrixResult[],
  labelKey: string
): TimeSeriesPoint[] {
  const timeMap = new Map<number, TimeSeriesPoint>();

  for (const s of series) {
    const label = s.metric[labelKey] || "unknown";
    for (const [t, v] of s.values) {
      let point = timeMap.get(t);
      if (!point) {
        point = { time: t };
        timeMap.set(t, point);
      }
      point[label] = parseFloat(v) || 0;
    }
  }

  return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
}

function latestValues(data: TimeSeriesPoint[]): Record<string, number> {
  if (data.length === 0) return {};
  const last = data[data.length - 1];
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(last)) {
    if (key !== "time") result[key] = Math.round(val as number);
  }
  return result;
}

function toDelta(data: TimeSeriesPoint[]): TimeSeriesPoint[] {
  if (data.length < 2) return [];
  const result: TimeSeriesPoint[] = [];
  for (let i = 1; i < data.length; i++) {
    const point: TimeSeriesPoint = { time: data[i].time };
    for (const key of Object.keys(data[i])) {
      if (key === "time") continue;
      const diff = (data[i][key] as number) - ((data[i - 1][key] as number) || 0);
      point[key] = Math.max(0, Math.round(diff));
    }
    result.push(point);
  }
  return result;
}

function matrixToLabeledSeries(
  series: MatrixResult[],
  labelKey: string
): LabeledSeries[] {
  return series.map((s) => ({
    label: s.metric[labelKey] || "unknown",
    data: s.values.map(([t, v]) => ({ time: t, value: parseFloat(v) || 0 })),
  }));
}
