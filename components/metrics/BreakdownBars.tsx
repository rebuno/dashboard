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
    <div className="border border-gray-200 rounded-md p-4 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">
        {label}
      </div>
      {entries.length === 0 && (
        <div className="text-sm text-gray-400 dark:text-gray-400">No data</div>
      )}
      <div className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24 truncate dark:text-gray-400">
              {key}
            </span>
            <div className="flex-1 bg-gray-100 rounded h-3 dark:bg-gray-800">
              <div
                className="bg-blue-500 h-3 rounded"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-8 text-right dark:text-gray-300">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
