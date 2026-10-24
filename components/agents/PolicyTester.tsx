"use client";

import { useEffect, useId, useRef, useState } from "react";
import PolicyExecutionPicker from "@/components/agents/PolicyExecutionPicker";
import PolicyTestResults from "@/components/agents/PolicyTestResults";
import { type PolicyTestReport, testPolicy } from "@/lib/api";
import {
  STEP_KINDS,
  type StepKind,
  VERDICTS,
  type Verdict,
} from "@/lib/policy";
import { parseTestCase } from "@/lib/policy-test";

type Mode = "input" | "replay";
const verdictLabels: Record<Verdict, string> = {
  allow: "Allow",
  deny: "Deny",
  require_approval: "Require approval",
};
const field = "field-control w-full px-2.5 py-2 text-xs";
const label = "mb-1.5 block text-xs font-medium text-ink-muted";

export default function PolicyTester({
  agentId,
  bundle,
}: {
  agentId: string;
  bundle: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("input");
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<StepKind>("tool_call");
  const [args, setArgs] = useState("{}");
  const [expect, setExpect] = useState<Verdict | "">("");
  const [expectRule, setExpectRule] = useState("");
  const [subject, setSubject] = useState("");
  const [subjectGroups, setSubjectGroups] = useState("");
  const [executionId, setExecutionId] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null,
  );
  const [result, setResult] = useState<{
    key: string;
    mode: Mode;
    report: PolicyTestReport;
  } | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const input = {
    target,
    kind,
    args,
    expect,
    expectRule,
    subject,
    subjectGroups,
  };
  const key = JSON.stringify({
    agentId,
    bundle,
    mode,
    input: mode === "input" ? input : executionId,
  });

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (activeRequest.current) return;
    setError(null);
    if (!bundle.trim()) {
      setError({ key, message: "Enter a policy above before testing." });
      return;
    }
    const controller = new AbortController();
    try {
      const request =
        mode === "input"
          ? { bundle, cases: [parseTestCase(input)] }
          : { bundle, execution_id: executionId };
      if (mode === "replay" && !executionId) {
        throw new Error("Choose an execution to replay.");
      }
      activeRequest.current = controller;
      setRunning(true);
      const report = await testPolicy(agentId, request, controller.signal);
      if (!controller.signal.aborted) setResult({ key, mode, report });
    } catch (err) {
      if (!controller.signal.aborted) {
        setError({
          key,
          message: err instanceof Error ? err.message : "Failed to test policy",
        });
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (!controller.signal.aborted) setRunning(false);
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-muted"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-canvas text-accent">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4"
          >
            <path
              d="m7 4 9 6-9 6V4Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="flex-1">
          <span className="block text-xs font-semibold text-ink">
            Test policy
          </span>
          <span className="mt-0.5 block text-[11px] text-ink-muted">
            Try an input or replay an execution before saving.
          </span>
        </span>
        <span aria-hidden="true" className="text-sm text-ink-muted">
          {open ? "−" : "+"}
        </span>
      </button>

      <div id={`${id}-panel`} hidden={!open} className="border-t border-line">
        <div className="border-b border-line bg-surface-muted/50 px-4 py-3">
          <p className="text-xs text-ink-soft">
            Tests the policy shown above, including unsaved changes. No changes
            are saved.
          </p>
        </div>
        <div className="grid divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <form onSubmit={run} className="min-w-0 space-y-4 p-4">
            <div
              className="flex rounded-md border border-line bg-canvas p-0.5"
              role="group"
              aria-label="Test source"
            >
              {(["input", "replay"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={mode === item}
                  onClick={() => setMode(item)}
                  className={`flex-1 rounded px-3 py-1.5 text-xs transition-colors ${mode === item ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
                >
                  {item === "input" ? "Manual input" : "Replay execution"}
                </button>
              ))}
            </div>

            {mode === "input" ? (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
                  <div>
                    <label htmlFor={`${id}-target`} className={label}>
                      Target
                    </label>
                    <input
                      id={`${id}-target`}
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="Tool name or model ID"
                      spellCheck={false}
                      className={`${field} font-mono`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${id}-kind`} className={label}>
                      Step kind
                    </label>
                    <select
                      id={`${id}-kind`}
                      value={kind}
                      onChange={(e) => setKind(e.target.value as StepKind)}
                      className={field}
                    >
                      {STEP_KINDS.map((value) => (
                        <option key={value} value={value}>
                          {value === "tool_call"
                            ? "Tool call"
                            : value === "llm_call"
                              ? "Model call"
                              : "Local"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor={`${id}-args`} className={label}>
                    Arguments (JSON)
                  </label>
                  <textarea
                    id={`${id}-args`}
                    value={args}
                    onChange={(e) => setArgs(e.target.value)}
                    rows={5}
                    spellCheck={false}
                    className={`${field} resize-y font-mono leading-relaxed`}
                  />
                </div>
                <div>
                  <label htmlFor={`${id}-expect`} className={label}>
                    Expected decision
                  </label>
                  <select
                    id={`${id}-expect`}
                    value={expect}
                    onChange={(e) => setExpect(e.target.value as Verdict | "")}
                    className={field}
                  >
                    <option value="">Just show the decision</option>
                    {VERDICTS.map((value) => (
                      <option key={value} value={value}>
                        {verdictLabels[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <details className="rounded-md border border-line px-3 py-2.5 text-xs">
                  <summary className="cursor-pointer font-medium text-ink-muted">
                    Rule and identity options
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label htmlFor={`${id}-rule`} className={label}>
                        Expected rule ID
                      </label>
                      <input
                        id={`${id}-rule`}
                        value={expectRule}
                        onChange={(e) => setExpectRule(e.target.value)}
                        placeholder="Optional"
                        spellCheck={false}
                        className={`${field} font-mono`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${id}-subject`} className={label}>
                        Subject
                      </label>
                      <input
                        id={`${id}-subject`}
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="user:alice@example.com"
                        spellCheck={false}
                        className={`${field} font-mono`}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${id}-groups`} className={label}>
                        Subject groups
                      </label>
                      <input
                        id={`${id}-groups`}
                        value={subjectGroups}
                        onChange={(e) => setSubjectGroups(e.target.value)}
                        placeholder="engineering, platform"
                        spellCheck={false}
                        className={field}
                      />
                      <p className="mt-1 text-[11px] text-ink-muted">
                        Separate group names with commas.
                      </p>
                    </div>
                  </div>
                </details>
                <p className="text-[11px] leading-relaxed text-ink-muted">
                  Manual inputs have no prior steps. Replay an execution to test
                  history conditions against recorded activity.
                </p>
              </>
            ) : (
              <div className="space-y-3">
                {open && (
                  <PolicyExecutionPicker
                    agentId={agentId}
                    value={executionId}
                    onChange={setExecutionId}
                  />
                )}
                <p className="text-xs leading-relaxed text-ink-muted">
                  Re-evaluate its steps using this draft and compare with the
                  recorded decisions. Tools are not run again.
                </p>
              </div>
            )}

            {!bundle.trim() && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Enter a policy above before testing.
              </p>
            )}
            {error?.key === key && (
              <p
                role="alert"
                className="break-words text-xs text-red-700 dark:text-red-400"
              >
                {error.message}
              </p>
            )}
            <button
              type="submit"
              disabled={
                running || !bundle.trim() || (mode === "replay" && !executionId)
              }
              className="button-primary w-full"
            >
              {running
                ? "Testing…"
                : mode === "replay"
                  ? "Replay execution"
                  : "Run test"}
            </button>
            <p className="text-[11px] leading-relaxed text-ink-muted">
              Rate limits and token budgets are not simulated. Judge rules can
              call the configured model provider.
            </p>
          </form>

          <div
            className="min-w-0 bg-canvas/50 p-4"
            role="region"
            aria-labelledby={`${id}-results-title`}
            aria-busy={running}
          >
            <h3
              id={`${id}-results-title`}
              className="mb-3 text-xs font-semibold text-ink"
            >
              Results
            </h3>
            {running && (
              <p role="status" className="mb-3 text-xs text-ink-muted">
                Evaluating the submitted policy…
              </p>
            )}
            {result ? (
              <PolicyTestResults
                report={result.report}
                replay={result.mode === "replay"}
                stale={result.key !== key}
              />
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong p-5 text-center">
                <p className="text-xs font-medium text-ink-soft">
                  See what your policy decides
                </p>
                <p className="mt-2 max-w-60 text-xs leading-relaxed text-ink-muted">
                  Run a test to see the decision, matched rule, and explanation
                  here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
