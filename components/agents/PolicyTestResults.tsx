"use client";

import Link from "next/link";
import JsonBlock from "@/components/JsonBlock";
import type { PolicyTestReport, PolicyTestResult } from "@/lib/api";

const labels: Record<string, string> = {
  allow: "Allow",
  deny: "Deny",
  require_approval: "Require approval",
};

function DecisionBadge({ decision }: { decision: string }) {
  const styles: Record<string, string> = {
    allow: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    deny: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    require_approval:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  };
  return (
    <span
      className={`inline-flex rounded px-2 py-1 text-xs font-medium ${styles[decision] ?? "bg-surface-muted text-ink-soft"}`}
    >
      {labels[decision] ?? decision}
    </span>
  );
}

function ResultCard({
  result,
  replay,
}: {
  result: PolicyTestResult;
  replay: boolean;
}) {
  const asserted = Boolean(result.expect || result.expect_rule);
  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-all font-mono text-xs font-medium text-ink">
          {result.name || result.target}
        </span>
        <DecisionBadge decision={result.decision} />
      </div>
      <dl className="space-y-1.5 text-xs">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink-muted">Matched rule</dt>
          <dd className="break-all font-mono text-ink-soft">
            {result.rule_id || "No rule"}
          </dd>
        </div>
        {replay && result.expect && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ink-muted">Recorded decision</dt>
            <dd className="text-ink-soft">
              {labels[result.expect] ?? result.expect}
              {result.was_rule && (
                <span className="ml-1 font-mono">({result.was_rule})</span>
              )}
            </dd>
          </div>
        )}
      </dl>
      {result.reason && (
        <p className="break-words text-xs leading-relaxed text-ink-soft">
          {result.reason}
        </p>
      )}
      <div className="border-t border-line pt-2 text-xs">
        {!asserted ? (
          <p className="text-ink-muted">
            {replay
              ? "No recorded decision to compare."
              : "No expectation set."}
          </p>
        ) : result.pass ? (
          <p className="text-green-700 dark:text-green-400">
            {replay ? "Decision unchanged" : "Expectation matched"}
            {!replay && result.expect && ` · ${labels[result.expect]}`}
            {!replay && result.expect_rule && ` · rule ${result.expect_rule}`}
          </p>
        ) : (
          <p className="text-red-700 dark:text-red-400">
            {replay ? "Decision changed" : "Expectation not met"}
            {result.failure && `: ${result.failure}`}
          </p>
        )}
      </div>
      {result.step_id && (
        <p className="break-all font-mono text-[11px] text-ink-muted">
          Step {result.step_id}
        </p>
      )}
      <JsonBlock label="Arguments" value={result.args} />
    </div>
  );
}

export default function PolicyTestResults({
  report,
  replay,
  stale,
}: {
  report: PolicyTestReport;
  replay: boolean;
  stale: boolean;
}) {
  const asserted = report.results.filter(
    (r) => r.expect || r.expect_rule,
  ).length;
  const executionId = report.results.find((r) => r.execution_id)?.execution_id;

  return (
    <div className="space-y-3">
      {stale && (
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        >
          The policy or test input has changed. Run again to update these
          results.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p role="status" className="font-medium text-ink-soft">
          {report.results.length}{" "}
          {replay ? "steps evaluated" : "case evaluated"}
          {asserted > 0 &&
            (replay
              ? ` · ${report.failed} changed`
              : ` · ${report.failed} expectations failed`)}
        </p>
        {executionId && (
          <Link
            href={`/executions/${encodeURIComponent(executionId)}`}
            className="text-accent hover:underline"
          >
            View execution ↗
          </Link>
        )}
      </div>
      {report.results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-5 text-center text-xs text-ink-muted">
          This execution has no steps to evaluate. Choose another execution.
        </p>
      ) : (
        <div className="max-h-[32rem] space-y-2 overflow-y-auto">
          {report.results.map((result, index) => (
            <ResultCard
              key={`${result.step_id ?? result.target}-${index}`}
              result={result}
              replay={replay}
            />
          ))}
        </div>
      )}
      {!!report.unexercised_rules?.length && (
        <details className="rounded-md border border-line bg-surface p-2.5 text-xs">
          <summary className="cursor-pointer text-ink-muted">
            {report.unexercised_rules.length} rules not exercised
          </summary>
          <p className="mt-2 text-ink-muted">
            These rules did not decide any of the tested inputs.
          </p>
          <ul className="mt-2 space-y-1 font-mono text-ink-soft">
            {report.unexercised_rules.map((rule) => (
              <li key={rule} className="break-all">
                {rule}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
