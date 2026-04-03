"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import MetricPanel from "./MetricPanel";
import ChartTooltip from "./ChartTooltip";

interface Props {
  value: number;
  series: { time: number; value: number }[];
}

function formatTime(t: number) {
  return new Date(t * 1000).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActiveExecutionsPanel({ value, series }: Props) {
  const expandedContent = (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <span className="text-4xl font-mono text-accent tabular-nums">{value}</span>
      </div>
      {series.length > 1 && (
        <div className="h-[55vh]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
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
                domain={[0, "auto"]}
                tick={{ fontSize: 10, fontFamily: "var(--font-ibm-plex-mono)", fill: "#6b7280" }}
                stroke="#2e2e36"
                width={30}
              />
              <Tooltip content={<ChartTooltip formatter={(v) => Math.round(v).toString()} />} />
              <Area
                type="stepAfter"
                dataKey="value"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.1}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  return (
    <MetricPanel title="Active Executions" subtitle="Current gauge" expandedChildren={expandedContent}>
      <div className="flex items-end gap-4 h-full">
        <div className="shrink-0">
          <span className="text-3xl font-mono text-accent tabular-nums">{value}</span>
        </div>
        {series.length > 1 && (
          <div className="flex-1 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <YAxis domain={[0, "auto"]} hide />
                <Area
                  type="stepAfter"
                  dataKey="value"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </MetricPanel>
  );
}
