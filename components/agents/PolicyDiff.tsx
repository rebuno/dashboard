import { useMemo } from "react";
import { diffLines } from "@/lib/diff";

const LINE_STYLES = {
  context: "text-gray-700 dark:text-gray-300",
  added: "bg-green-50 text-green-900 dark:bg-green-950/50 dark:text-green-200",
  removed: "bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-200",
};

const LINE_MARKERS = { context: " ", added: "+", removed: "-" };

export default function PolicyDiff({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const lines = useMemo(() => diffLines(before, after), [before, after]);
  const added = lines.filter((line) => line.kind === "added").length;
  const removed = lines.filter((line) => line.kind === "removed").length;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-muted px-3 py-2 text-xs">
        <span className="font-medium text-ink-soft">Policy changes</span>
        <div className="flex gap-3 font-mono">
          <span className="text-green-700 dark:text-green-300">
            +{added} added
          </span>
          <span className="text-red-700 dark:text-red-300">
            -{removed} removed
          </span>
        </div>
      </div>
      {added === 0 && removed === 0 && (
        <p className="px-3 py-2 text-xs text-ink-muted">No changes.</p>
      )}
      {lines.length > 0 && (
        <div
          role="region"
          aria-label="Policy diff, scrollable"
          tabIndex={0}
          className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <table className="w-full border-collapse font-mono text-xs leading-6">
            <caption className="sr-only">
              Policy diff. Removed lines belong to the current policy; added
              lines belong to the new policy.
            </caption>
            <thead className="border-b border-line bg-surface-muted text-[10px] text-ink-muted">
              <tr>
                <th scope="col" className="px-2 text-right font-normal">
                  Current
                </th>
                <th scope="col" className="px-2 text-right font-normal">
                  New
                </th>
                <th scope="col">
                  <span className="sr-only">Change</span>
                </th>
                <th scope="col">
                  <span className="sr-only">YAML</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr
                  key={`${line.kind}:${line.oldLineNumber}:${line.newLineNumber}`}
                  className={LINE_STYLES[line.kind]}
                >
                  <td className="w-12 select-none px-2 text-right align-top tabular-nums opacity-60">
                    {line.oldLineNumber}
                  </td>
                  <td className="w-12 select-none border-r border-current/10 px-2 text-right align-top tabular-nums opacity-60">
                    {line.newLineNumber}
                  </td>
                  <td className="w-6 select-none px-2 text-center align-top font-semibold">
                    <span className="sr-only">
                      {line.kind === "context" ? "Unchanged" : line.kind}
                    </span>
                    <span aria-hidden="true">{LINE_MARKERS[line.kind]}</span>
                  </td>
                  <td className="py-0 pr-3 align-top">
                    <code className="block whitespace-pre font-mono">
                      {line.text || "\u00a0"}
                    </code>
                    {!line.hasNewline && (
                      <span className="block text-[10px] italic opacity-75">
                        {"\\ No newline at end of file"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
