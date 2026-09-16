export default function BreakdownBars({
  label,
  data,
}: {
  label: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="surface-card min-h-36 p-5">
      <div className="mb-4 text-xs font-medium text-ink-muted">{label}</div>
      {entries.length === 0 && (
        <div className="text-sm text-ink-faint">No data for this range</div>
      )}
      <div className="space-y-3">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3"
          >
            <span className="truncate text-xs text-ink-muted">{key}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
            <span className="text-right font-mono text-xs tabular-nums text-ink-soft">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
