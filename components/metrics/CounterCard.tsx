export default function CounterCard({
  label,
  value,
  current = false,
}: {
  label: string;
  value: number | null;
  current?: boolean;
}) {
  return (
    <div className="surface-card p-5">
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-3xl font-medium tracking-[-0.035em] tabular-nums">
          {value ?? "—"}
        </span>
        {current && (
          <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            current
          </span>
        )}
      </div>
    </div>
  );
}
