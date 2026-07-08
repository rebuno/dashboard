export interface Sample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export function parsePrometheusText(text: string): Sample[] {
  const samples: Sample[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;

    const braceIdx = line.indexOf("{");
    let name: string;
    const labels: Record<string, string> = {};
    let rest: string;

    if (braceIdx !== -1) {
      name = line.slice(0, braceIdx);
      const closeBrace = line.indexOf("}", braceIdx);
      if (closeBrace === -1) continue;
      const labelStr = line.slice(braceIdx + 1, closeBrace);
      rest = line.slice(closeBrace + 1).trim();

      const labelRegex = /(\w+)="((?:[^"\\]|\\.)*)"/g;
      let match: RegExpExecArray | null;
      while ((match = labelRegex.exec(labelStr)) !== null) {
        labels[match[1]] = match[2];
      }
    } else {
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx === -1) continue;
      name = line.slice(0, spaceIdx);
      rest = line.slice(spaceIdx + 1).trim();
    }

    const parts = rest.split(/\s+/);
    const value = parseFloat(parts[0]);
    if (Number.isNaN(value)) continue;

    samples.push({ name, labels, value });
  }
  return samples;
}

export function groupByLabel(samples: Sample[], metricName: string, labelKey: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const s of samples) {
    if (s.name !== metricName) continue;
    const key = s.labels[labelKey] ?? "unknown";
    result[key] = (result[key] ?? 0) + s.value;
  }
  return result;
}

export function singleValue(samples: Sample[], metricName: string): number | null {
  const match = samples.find((s) => s.name === metricName);
  return match ? match.value : null;
}

export function histogramQuantile(samples: Sample[], baseMetricName: string, quantile: number): number | null {
  const buckets = samples
    .filter((s) => s.name === `${baseMetricName}_bucket`)
    .map((s) => ({ le: s.labels.le === "+Inf" ? Infinity : parseFloat(s.labels.le), count: s.value }))
    .filter((b) => !Number.isNaN(b.le))
    .sort((a, b) => a.le - b.le);

  if (buckets.length === 0) return null;
  const total = buckets[buckets.length - 1].count;
  if (total <= 0) return null;

  const target = quantile * total;
  let prev = { le: 0, count: 0 };
  for (const b of buckets) {
    if (b.count >= target) {
      if (b.count === prev.count) return b.le === Infinity ? prev.le : b.le;
      const fraction = (target - prev.count) / (b.count - prev.count);
      const upper = b.le === Infinity ? prev.le : b.le;
      return prev.le + fraction * (upper - prev.le);
    }
    prev = b;
  }
  return prev.le === Infinity ? null : prev.le;
}
