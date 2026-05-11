"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";
import MetricPanel from "./MetricPanel";
import ChartTooltip from "./ChartTooltip";
import type { TimeSeriesPoint } from "@/lib/prometheus";
import { formatTimeForRange } from "@/lib/chart-utils";

const STATUS_COLORS: Record<string, string> = {
  created: "#3B82F6",
  completed: "#3ddc84",
  failed: "#f44336",
  cancelled: "#6b7280",
};

const STATUSES = ["created", "completed", "failed", "cancelled"];

interface Props {
  totals: Record<string, number>;
  data: TimeSeriesPoint[];
}

function TotalsRow({ totals }: { totals: Record<string, number> }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      {STATUSES.map((s) => (
        totals[s] != null && (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
            <span className="text-[10px] font-mono text-gray-500">{s}</span>
            <span className="text-sm font-mono tabular-nums" style={{ color: STATUS_COLORS[s] }}>
              {totals[s].toLocaleString()}
            </span>
          </div>
        )
      ))}
    </div>
  );
}

function Chart({ data, height }: { data: TimeSeriesPoint[]; height: string }) {
  const formatTime = useMemo(() => formatTimeForRange(data), [data]);
  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e2e36" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fontFamily: "var(--font-ibm-plex-mono)", fill: "#6b7280" }}
            stroke="#2e2e36"
            interval="equidistantPreserveStart"
            minTickGap={60}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fontFamily: "var(--font-ibm-plex-mono)", fill: "#6b7280" }}
            stroke="#2e2e36"
            width={30}
          />
          <Tooltip content={<ChartTooltip formatter={(v) => Math.round(v).toLocaleString()} />} />
          {STATUSES.map((status) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="1"
              fill={STATUS_COLORS[status]}
              fillOpacity={0.8}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ExecutionsTotalPanel({ totals, data }: Props) {
  const hasTotals = Object.keys(totals).length > 0;

  const content = data.length > 0 ? (
    <>
      {hasTotals && <TotalsRow totals={totals} />}
      <Chart data={data} height="h-40" />
    </>
  ) : (
    <NoData />
  );

  const expandedContent = data.length > 0 ? (
    <>
      {hasTotals && <TotalsRow totals={totals} />}
      <Chart data={data} height="h-[60vh]" />
    </>
  ) : (
    <NoData />
  );

  return (
    <MetricPanel title="Executions" subtitle="Per interval by status" expandedChildren={expandedContent}>
      {content}
    </MetricPanel>
  );
}

function NoData() {
  return (
    <div className="h-48 flex items-center justify-center">
      <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">
        No data
      </span>
    </div>
  );
}
