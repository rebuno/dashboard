const KERNEL_URL = process.env.KERNEL_URL || "http://localhost:8080";
const KERNEL_API_KEY = process.env.KERNEL_API_KEY || "";
const SCRAPE_INTERVAL = 15_000;
const MAX_SAMPLES = 5_760; // ~24h at 15s intervals

interface Sample {
  t: number;
  v: number;
}

interface TimeSeries {
  metric: string;
  labels: Record<string, string>;
  samples: Sample[];
}

interface VectorResult {
  metric: Record<string, string>;
  value: [number, string];
}

interface MatrixResult {
  metric: Record<string, string>;
  values: [number, string][];
}

const store = new Map<string, TimeSeries>();

function seriesKey(metric: string, labels: Record<string, string>): string {
  const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  const lbl = sorted.map(([k, v]) => `${k}="${v}"`).join(",");
  return lbl ? `${metric}{${lbl}}` : metric;
}

function getOrCreate(metric: string, labels: Record<string, string>): TimeSeries {
  const key = seriesKey(metric, labels);
  let ts = store.get(key);
  if (!ts) {
    ts = { metric, labels, samples: [] };
    store.set(key, ts);
  }
  return ts;
}

function addSample(metric: string, labels: Record<string, string>, t: number, v: number) {
  const ts = getOrCreate(metric, labels);
  ts.samples.push({ t, v });
  if (ts.samples.length > MAX_SAMPLES) {
    ts.samples = ts.samples.slice(-MAX_SAMPLES);
  }
}

function parsePrometheusText(text: string) {
  const now = Date.now() / 1000;
  const lines = text.split("\n");

  for (const line of lines) {
    if (!line || line.startsWith("# ")) continue;

    // Format: metric_name{label="value",...} value [timestamp]
    // or:     metric_name value [timestamp]
    const braceIdx = line.indexOf("{");
    let metric: string;
    let labels: Record<string, string> = {};
    let rest: string;

    if (braceIdx !== -1) {
      metric = line.slice(0, braceIdx);
      const closeBrace = line.indexOf("}", braceIdx);
      const labelStr = line.slice(braceIdx + 1, closeBrace);
      rest = line.slice(closeBrace + 2); // skip "} "

      const labelRegex = /(\w+)="([^"]*)"/g;
      let match;
      while ((match = labelRegex.exec(labelStr)) !== null) {
        labels[match[1]] = match[2];
      }
    } else {
      const spaceIdx = line.indexOf(" ");
      metric = line.slice(0, spaceIdx);
      rest = line.slice(spaceIdx + 1);
    }

    const parts = rest.trim().split(/\s+/);
    const value = parseFloat(parts[0]);
    if (isNaN(value)) continue;

    addSample(metric, labels, now, value);
  }
}

let scraping = false;

async function scrape() {
  try {
    const headers: Record<string, string> = {};
    if (KERNEL_API_KEY) {
      headers["Authorization"] = `Bearer ${KERNEL_API_KEY}`;
    }
    const resp = await fetch(`${KERNEL_URL}/metrics`, { headers });
    if (!resp.ok) return;
    const text = await resp.text();
    parsePrometheusText(text);
  } catch {
    // Kernel unavailable — skip this scrape
  }
}

export function ensureScraping() {
  if (scraping) return;
  scraping = true;
  scrape(); // immediate first scrape
  setInterval(scrape, SCRAPE_INTERVAL);
}

function findSeries(metric: string): TimeSeries[] {
  const results: TimeSeries[] = [];
  for (const ts of store.values()) {
    if (ts.metric === metric) results.push(ts);
  }
  return results;
}

export function instantQuery(expr: string): { resultType: string; result: VectorResult[] } {
  const metric = expr.trim();
  const series = findSeries(metric);

  const result: VectorResult[] = series
    .filter((ts) => ts.samples.length > 0)
    .map((ts) => ({
      metric: { __name__: ts.metric, ...ts.labels },
      value: [
        ts.samples[ts.samples.length - 1].t,
        String(ts.samples[ts.samples.length - 1].v),
      ] as [number, string],
    }));

  return { resultType: "vector", result };
}

export function rangeQuery(
  expr: string,
  start: number,
  end: number,
  step: number
): { resultType: string; result: MatrixResult[] } {
  const metric = expr.trim();
  const series = findSeries(metric);

  const result: MatrixResult[] = series.map((ts) => {
    const values: [number, string][] = [];
    for (let t = start; t <= end; t += step) {
      let closest: Sample | null = null;
      for (const s of ts.samples) {
        if (s.t <= t + step / 2 && s.t >= t - step / 2) {
          closest = s;
        }
      }
      if (closest) {
        values.push([t, String(closest.v)]);
      }
    }
    return {
      metric: { __name__: ts.metric, ...ts.labels },
      values,
    };
  });

  return { resultType: "matrix", result };
}

export function rateQuery(
  metric: string,
  start: number,
  end: number,
  step: number
): { resultType: string; result: MatrixResult[] } {
  const series = findSeries(metric);

  const result: MatrixResult[] = series.map((ts) => {
    const values: [number, string][] = [];
    for (let t = start; t <= end; t += step) {
      // Find samples in window [t - step, t]
      const windowStart = t - step;
      let first: Sample | null = null;
      let last: Sample | null = null;

      for (const s of ts.samples) {
        if (s.t >= windowStart && s.t <= t) {
          if (!first || s.t < first.t) first = s;
          if (!last || s.t > last.t) last = s;
        }
      }

      if (first && last && first !== last && last.t > first.t) {
        const rate = (last.v - first.v) / (last.t - first.t);
        values.push([t, String(Math.max(0, rate))]);
      }
    }

    return {
      metric: { __name__: metric, ...ts.labels },
      values,
    };
  });

  return { resultType: "matrix", result };
}

export function histogramQuantileQuery(
  quantile: number,
  metric: string,
  start: number,
  end: number,
  step: number
): { resultType: string; result: MatrixResult[] } {
  const bucketMetric = `${metric}_bucket`;
  const allBuckets = findSeries(bucketMetric);

  const groups = new Map<string, TimeSeries[]>();
  for (const ts of allBuckets) {
    const groupLabels = { ...ts.labels };
    delete groupLabels.le;
    const key = seriesKey(metric, groupLabels);
    const group = groups.get(key) || [];
    group.push(ts);
    groups.set(key, group);
  }

  const result: MatrixResult[] = [];

  for (const [, buckets] of groups) {
    const sorted = buckets
      .filter((b) => b.labels.le !== undefined)
      .sort((a, b) => parseFloat(a.labels.le) - parseFloat(b.labels.le));

    if (sorted.length === 0) continue;

    const groupLabels = { ...sorted[0].labels };
    delete groupLabels.le;

    const values: [number, string][] = [];

    for (let t = start; t <= end; t += step) {
      const bucketValues: { le: number; count: number }[] = [];
      for (const ts of sorted) {
        const le = parseFloat(ts.labels.le);
        let closest: Sample | null = null;
        for (const s of ts.samples) {
          if (s.t <= t + step / 2 && s.t >= t - step / 2) {
            closest = s;
          }
        }
        if (closest) {
          bucketValues.push({ le, count: closest.v });
        }
      }

      if (bucketValues.length < 2) continue;

      const total = bucketValues[bucketValues.length - 1].count;
      if (total === 0) continue;

      const target = quantile * total;
      let prev = { le: 0, count: 0 };

      for (const b of bucketValues) {
        if (b.count >= target) {
          // Linear interpolation
          const fraction =
            b.count === prev.count
              ? 0
              : (target - prev.count) / (b.count - prev.count);
          const val = prev.le + fraction * (b.le - prev.le);
          values.push([t, String(val)]);
          break;
        }
        prev = b;
      }
    }

    result.push({
      metric: { __name__: metric, ...groupLabels },
      values,
    });
  }

  return { resultType: "matrix", result };
}
