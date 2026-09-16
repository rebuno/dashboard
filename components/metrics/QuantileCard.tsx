export default function QuantileCard({
  label,
  p50,
  p95,
  p99,
}: {
  label: string;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}) {
  function fmt(v: number | null) {
    return v == null ? "—" : `${(v * 1000).toFixed(0)}ms`;
  }
  return (
    <div className="surface-card p-5">
      <div className="mb-4 text-xs font-medium text-ink-muted">{label}</div>
      <div className="grid grid-cols-3 divide-x divide-line">
        {[
          ["p50", p50],
          ["p95", p95],
          ["p99", p99],
        ].map(([percentile, value]) => (
          <div key={percentile as string} className="px-3 first:pl-0 last:pr-0">
            <div className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              {percentile}
            </div>
            <div className="mt-1 font-mono text-sm font-medium text-ink-soft">
              {fmt(value as number | null)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
