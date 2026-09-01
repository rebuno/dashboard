export default function CounterCard({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="border border-gray-200 rounded-md p-4 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide dark:text-gray-400">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value ?? "—"}</div>
    </div>
  );
}
