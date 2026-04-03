"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import MetricPanel from "./MetricPanel";
import ChartTooltip from "./ChartTooltip";
import type { LabeledSeries, TimeSeriesPoint } from "@/lib/prometheus";

const PERCENTILE_COLORS = {
  p50: "#4dd0e1",
  p95: "#e8a832",
  p99: "#f44336",
};

function formatTime(t: number) {
  return new Date(t * 1000).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 0.001) return `${(seconds * 1_000_000).toFixed(0)}us`;
  if (seconds < 1) return `${(seconds * 1000).toFixed(1)}ms`;
  return `${seconds.toFixed(2)}s`;
}

function mergePercentiles(
  p50: LabeledSeries[],
  p95: LabeledSeries[],
  p99: LabeledSeries[]
): TimeSeriesPoint[] {
  const timeMap = new Map<number, TimeSeriesPoint>();

  for (const s of p50.flatMap((s) => s.data)) {
    const point = timeMap.get(s.time) || { time: s.time };
    point.p50 = s.value;
    timeMap.set(s.time, point);
  }
  for (const s of p95.flatMap((s) => s.data)) {
    const point = timeMap.get(s.time) || { time: s.time };
    point.p95 = s.value;
    timeMap.set(s.time, point);
  }
  for (const s of p99.flatMap((s) => s.data)) {
    const point = timeMap.get(s.time) || { time: s.time };
    point.p99 = s.value;
    timeMap.set(s.time, point);
  }

  return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
}

function Legend() {
  return (
    <div className="flex items-center gap-4 mt-2">
      {Object.entries(PERCENTILE_COLORS).map(([key, color]) => (
        <div key={key} className="flex items-center gap-1.5">
          <div className="w-2 h-0.5" style={{ backgroundColor: color }} />
          <span className="text-[9px] font-mono text-gray-500 uppercase">{key}</span>
        </div>
      ))}
    </div>
  );
}

function Chart({ data, height }: { data: TimeSeriesPoint[]; height: string }) {
  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e2e36" />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fontFamily: "var(--font-ibm-plex-mono)", fill: "#6b7280" }}
            stroke="#2e2e36"
            interval="equidistantPreserveStart"
            minTickGap={60}
          />
          <YAxis
            tickFormatter={formatDuration}
            tick={{ fontSize: 10, fontFamily: "var(--font-ibm-plex-mono)", fill: "#6b7280" }}
            stroke="#2e2e36"
            width={50}
          />
          <Tooltip content={<ChartTooltip formatter={formatDuration} />} />
          <Line type="monotone" dataKey="p50" stroke={PERCENTILE_COLORS.p50} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="p95" stroke={PERCENTILE_COLORS.p95} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="p99" stroke={PERCENTILE_COLORS.p99} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface Props {
  p50: LabeledSeries[];
  p95: LabeledSeries[];
  p99: LabeledSeries[];
}

export default function StepDurationPanel({ p50, p95, p99 }: Props) {
  const data = mergePercentiles(p50, p95, p99);
  const hasData = data.length > 0;

  const content = hasData ? (
    <div>
      <Chart data={data} height="h-44" />
      <Legend />
    </div>
  ) : (
    <NoData />
  );

  const expandedContent = hasData ? (
    <div>
      <Chart data={data} height="h-[60vh]" />
      <Legend />
    </div>
  ) : (
    <NoData />
  );

  return (
    <MetricPanel title="Step Duration" subtitle="Percentiles (p50 / p95 / p99)" expandedChildren={expandedContent}>
      {content}
    </MetricPanel>
  );
}

function NoData() {
  return (
    <div className="h-52 flex items-center justify-center">
      <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">
        No data
      </span>
    </div>
  );
}
