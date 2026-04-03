"use client";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
  formatter?: (value: number) => string;
}

export default function ChartTooltip({ active, payload, label, formatter }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const time = label
    ? new Date(label * 1000).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  const fmt = formatter || ((v: number) => v.toFixed(4));

  return (
    <div className="bg-surface-2 border border-border px-3 py-2 shadow-xl">
      <p className="text-[10px] font-mono text-gray-500 mb-1">{time}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-[11px] font-mono">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-400">{entry.name}</span>
          <span className="text-gray-200 ml-auto tabular-nums">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}
