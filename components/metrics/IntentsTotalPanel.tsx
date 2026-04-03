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
import MetricPanel from "./MetricPanel";
import ChartTooltip from "./ChartTooltip";
import type { TimeSeriesPoint } from "@/lib/prometheus";

const DECISION_COLORS: Record<string, string> = {
  accepted: "#3ddc84",
  denied: "#f44336",
  rate_limited: "#e8a832",
  pending_approval: "#b388ff",
};

const DECISIONS = ["accepted", "denied", "rate_limited", "pending_approval"];

function formatTime(t: number) {
  return new Date(t * 1000).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  totals: Record<string, number>;
  data: TimeSeriesPoint[];
}

function TotalsRow({ totals }: { totals: Record<string, number> }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      {DECISIONS.map((d) => (
        totals[d] != null && (
          <div key={d} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DECISION_COLORS[d] }} />
            <span className="text-[10px] font-mono text-gray-500">{d}</span>
            <span className="text-sm font-mono tabular-nums" style={{ color: DECISION_COLORS[d] }}>
              {totals[d].toLocaleString()}
            </span>
          </div>
        )
      ))}
    </div>
  );
}

function Chart({ data, height }: { data: TimeSeriesPoint[]; height: string }) {
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
          {DECISIONS.map((decision) => (
            <Bar
              key={decision}
              dataKey={decision}
              stackId="1"
              fill={DECISION_COLORS[decision]}
              fillOpacity={0.8}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function IntentsTotalPanel({ totals, data }: Props) {
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
    <MetricPanel title="Intents" subtitle="Per interval by decision" expandedChildren={expandedContent}>
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
