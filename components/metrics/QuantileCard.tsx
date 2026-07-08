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
    <div className="border border-gray-200 rounded-md p-4 bg-white">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</div>
      <div className="flex gap-4 text-sm">
        <div>
          p50 <span className="font-medium">{fmt(p50)}</span>
        </div>
        <div>
          p95 <span className="font-medium">{fmt(p95)}</span>
        </div>
        <div>
          p99 <span className="font-medium">{fmt(p99)}</span>
        </div>
      </div>
    </div>
  );
}
