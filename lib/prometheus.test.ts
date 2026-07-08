import { describe, expect, it } from "vitest";
import { parsePrometheusText, groupByLabel, singleValue, histogramQuantile } from "./prometheus";

describe("parsePrometheusText", () => {
  it("parses metrics without labels", () => {
    const samples = parsePrometheusText("rebuno_executions_created_total 42\n");
    expect(samples).toEqual([{ name: "rebuno_executions_created_total", labels: {}, value: 42 }]);
  });

  it("parses metrics with labels", () => {
    const samples = parsePrometheusText(
      'rebuno_executions_completed_total{status="completed"} 10\nrebuno_executions_completed_total{status="failed"} 2\n'
    );
    expect(samples).toEqual([
      { name: "rebuno_executions_completed_total", labels: { status: "completed" }, value: 10 },
      { name: "rebuno_executions_completed_total", labels: { status: "failed" }, value: 2 },
    ]);
  });

  it("skips comment lines and blank lines", () => {
    const samples = parsePrometheusText(
      "# HELP rebuno_queue_depth depth\n# TYPE rebuno_queue_depth gauge\n\nrebuno_queue_depth 3\n"
    );
    expect(samples).toEqual([{ name: "rebuno_queue_depth", labels: {}, value: 3 }]);
  });
});

describe("groupByLabel", () => {
  it("sums values grouped by a label", () => {
    const samples = parsePrometheusText(
      'rebuno_steps_submitted_total{kind="tool_call"} 5\nrebuno_steps_submitted_total{kind="llm_call"} 3\n'
    );
    expect(groupByLabel(samples, "rebuno_steps_submitted_total", "kind")).toEqual({
      tool_call: 5,
      llm_call: 3,
    });
  });
});

describe("singleValue", () => {
  it("returns the value for an unlabeled metric", () => {
    const samples = parsePrometheusText("rebuno_queue_depth 7\n");
    expect(singleValue(samples, "rebuno_queue_depth")).toBe(7);
  });

  it("returns null when the metric is missing", () => {
    expect(singleValue([], "rebuno_queue_depth")).toBeNull();
  });
});

describe("histogramQuantile", () => {
  it("computes p50 from cumulative buckets via linear interpolation", () => {
    const text = [
      'rebuno_dispatch_latency_seconds_bucket{le="0.1"} 0',
      'rebuno_dispatch_latency_seconds_bucket{le="0.5"} 8',
      'rebuno_dispatch_latency_seconds_bucket{le="1"} 10',
      'rebuno_dispatch_latency_seconds_bucket{le="+Inf"} 10',
    ].join("\n");
    const samples = parsePrometheusText(text);
    const p50 = histogramQuantile(samples, "rebuno_dispatch_latency_seconds", 0.5);
    expect(p50).not.toBeNull();
    expect(p50 as number).toBeCloseTo(0.35, 5);
  });

  it("returns null when there are no buckets", () => {
    expect(histogramQuantile([], "rebuno_dispatch_latency_seconds", 0.5)).toBeNull();
  });
});
