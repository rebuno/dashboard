"use client";

import { useEffect, useState } from "react";
import { loadPolicy } from "@/lib/api";
import {
  ARG_OPS,
  DECISIONS,
  LIMITER_ERRORS,
  ON_EXCEEDS,
  PER_WHATS,
  STEP_KINDS,
  emptyBudget,
  emptyDraft,
  emptyRateLimit,
  emptyRule,
  lintDraft,
  parseBundle,
  serializeDraft,
  uid,
  validateDraft,
  type ArgOp,
  type Decision,
  type LimiterError,
  type OnExceed,
  type PerWhat,
  type PolicyDraft,
  type RuleDraft,
} from "@/lib/policy";

const DECISION_LABEL: Record<Decision, string> = {
  allow: "Allow",
  deny: "Deny",
  require_approval: "Require approval",
};

const DECISION_STYLE: Record<Decision, string> = {
  allow: "border-l-green-500",
  deny: "border-l-red-500",
  require_approval: "border-l-amber-500",
};

const ARG_OP_LABEL: Record<ArgOp, string> = {
  equals: "equals",
  contains: "contains",
  one_of: "is one of",
  regex: "matches regex",
};

const PER_WHAT_LABEL: Record<PerWhat, string> = {
  execution: "per execution",
  agent: "per agent",
  global: "across everything",
};

const LIMITER_ERROR_LABEL: Record<LimiterError, string> = {
  allow: "let the step through",
  deny: "reject the step",
};

const ON_EXCEED_LABEL: Record<OnExceed, string> = {
  deny: "reject the step",
  require_approval: "require approval",
};

const field = "border border-gray-300 rounded px-2 py-1 text-xs bg-white";
const rowLabel = "text-xs text-gray-400 w-16 shrink-0";

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function TokenInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  function commit() {
    const v = text.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setText("");
  }
  return (
    <div className="flex flex-wrap items-center gap-1 border border-gray-300 rounded px-1.5 py-1 bg-white flex-1 min-w-0">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 bg-gray-100 rounded px-1.5 py-0.5 text-xs font-mono"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="text-gray-400 hover:text-gray-700"
            aria-label={`Remove ${v}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        placeholder={values.length ? "" : placeholder}
        spellCheck={false}
        className="flex-1 min-w-[7rem] text-xs outline-none bg-transparent font-mono"
      />
    </div>
  );
}

function RuleCard({
  rule,
  index,
  total,
  errors,
  warnings,
  onPatch,
  onRemove,
  onMove,
  onDragStart,
  onDragOver,
  onDragEnd,
  dragging,
}: {
  rule: RuleDraft;
  index: number;
  total: number;
  errors: string[];
  warnings: string[];
  onPatch: (patch: Partial<RuleDraft>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  function addCondition(kind: string) {
    if (kind === "step_kind") onPatch({ stepKind: "tool_call" });
    else if (kind === "target") onPatch({ targets: [] });
    else if (kind === "agent") onPatch({ agentIds: [] });
    else if (kind === "argument") {
      onPatch({
        args: [
          ...rule.args,
          { uid: uid(), key: "", op: "equals", value: "", values: [] },
        ],
      });
    }
  }

  function patchArg(argUid: string, patch: Partial<RuleDraft["args"][number]>) {
    onPatch({
      args: rule.args.map((a) => (a.uid === argUid ? { ...a, ...patch } : a)),
    });
  }

  function patchLimit(patch: Partial<NonNullable<RuleDraft["rateLimit"]>>) {
    if (rule.rateLimit) onPatch({ rateLimit: { ...rule.rateLimit, ...patch } });
  }

  function patchBudget(patch: Partial<NonNullable<RuleDraft["budget"]>>) {
    if (rule.budget) onPatch({ budget: { ...rule.budget, ...patch } });
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      className={`border border-gray-200 border-l-4 ${DECISION_STYLE[rule.decision]} rounded-md bg-white ${
        dragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none px-1"
          aria-hidden
        >
          ⠿
        </span>
        <span className="text-xs text-gray-400 tabular-nums w-4">
          {index + 1}
        </span>
        <select
          value={rule.decision}
          onChange={(e) => onPatch({ decision: e.target.value as Decision })}
          className={`${field} font-medium`}
          aria-label="Decision"
        >
          {DECISIONS.map((d) => (
            <option key={d} value={d}>
              {DECISION_LABEL[d]}
            </option>
          ))}
        </select>
        <input
          value={rule.id}
          onChange={(e) => onPatch({ id: e.target.value })}
          placeholder="rule-id"
          spellCheck={false}
          className={`${field} font-mono flex-1 min-w-0`}
          aria-label="Rule id"
        />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-25 px-1"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(index + 1)}
            disabled={index === total - 1}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-25 px-1"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-400 hover:text-red-600 px-1"
            aria-label="Delete rule"
          >
            ×
          </button>
        </div>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wide text-gray-400">
          When{" "}
          {rule.stepKind === null &&
          rule.targets === null &&
          rule.agentIds === null &&
          !rule.args.length
            ? "— matches every step"
            : "all of"}
        </div>

        {rule.stepKind !== null && (
          <div className="flex items-center gap-2">
            <span className={rowLabel}>Step kind</span>
            <select
              value={rule.stepKind}
              onChange={(e) =>
                onPatch({ stepKind: e.target.value as RuleDraft["stepKind"] })
              }
              className={`${field} font-mono`}
            >
              {STEP_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onPatch({ stepKind: null })}
              className="text-gray-300 hover:text-gray-600 text-xs"
              aria-label="Remove step kind condition"
            >
              ×
            </button>
          </div>
        )}

        {rule.targets !== null && (
          <div className="flex items-center gap-2">
            <span className={rowLabel}>Target</span>
            <TokenInput
              values={rule.targets}
              onChange={(v) => onPatch({ targets: v })}
              placeholder="shell_exec, fs_write_* …"
            />
            <button
              type="button"
              onClick={() => onPatch({ targets: null })}
              className="text-gray-300 hover:text-gray-600 text-xs"
              aria-label="Remove target condition"
            >
              ×
            </button>
          </div>
        )}

        {rule.agentIds !== null && (
          <div className="flex items-center gap-2">
            <span className={rowLabel}>Agent</span>
            <TokenInput
              values={rule.agentIds}
              onChange={(v) => onPatch({ agentIds: v })}
              placeholder="agent id"
            />
            <button
              type="button"
              onClick={() => onPatch({ agentIds: null })}
              className="text-gray-300 hover:text-gray-600 text-xs"
              aria-label="Remove agent condition"
            >
              ×
            </button>
          </div>
        )}

        {rule.args.map((a) => (
          <div key={a.uid} className="flex items-center gap-2">
            <span className={rowLabel}>Argument</span>
            <input
              value={a.key}
              onChange={(e) => patchArg(a.uid, { key: e.target.value })}
              placeholder="command"
              spellCheck={false}
              className={`${field} font-mono w-28`}
              aria-label="Argument name"
            />
            <select
              value={a.op}
              onChange={(e) => patchArg(a.uid, { op: e.target.value as ArgOp })}
              className={field}
              aria-label="Argument operator"
            >
              {ARG_OPS.map((op) => (
                <option key={op} value={op}>
                  {ARG_OP_LABEL[op]}
                </option>
              ))}
            </select>
            {a.op === "one_of" ? (
              <TokenInput
                values={a.values}
                onChange={(v) => patchArg(a.uid, { values: v })}
                placeholder="value"
              />
            ) : (
              <input
                value={a.value}
                onChange={(e) => patchArg(a.uid, { value: e.target.value })}
                spellCheck={false}
                className={`${field} font-mono flex-1 min-w-0`}
                aria-label="Argument value"
              />
            )}
            <button
              type="button"
              onClick={() =>
                onPatch({ args: rule.args.filter((x) => x.uid !== a.uid) })
              }
              className="text-gray-300 hover:text-gray-600 text-xs"
              aria-label="Remove argument condition"
            >
              ×
            </button>
          </div>
        ))}

        <select
          value=""
          onChange={(e) => {
            addCondition(e.target.value);
            e.currentTarget.value = "";
          }}
          className="text-xs text-blue-600 bg-transparent border-none outline-none cursor-pointer py-0.5"
          aria-label="Add condition"
        >
          <option value="">+ add condition</option>
          {rule.stepKind === null && (
            <option value="step_kind">Step kind</option>
          )}
          {rule.targets === null && <option value="target">Target</option>}
          {rule.agentIds === null && <option value="agent">Agent</option>}
          <option value="argument">Argument</option>
        </select>

        <div className="text-[10px] uppercase tracking-wide text-gray-400 pt-1">
          Then
        </div>
        <div className="flex items-center gap-2">
          <span className={rowLabel}>Because</span>
          <input
            value={rule.reason}
            onChange={(e) => onPatch({ reason: e.target.value })}
            placeholder="reason (shown on deny, recorded in the audit event)"
            className={`${field} flex-1 min-w-0`}
            aria-label="Reason"
          />
        </div>

        {rule.decision === "require_approval" && (
          <div className="space-y-1.5 pl-2 border-l-2 border-amber-100 ml-1">
            <div className="flex items-center gap-2">
              <span className={rowLabel}>Approvers</span>
              <TokenInput
                values={rule.approvers}
                onChange={(v) => onPatch({ approvers: v })}
                placeholder="anyone can approve"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className={rowLabel}>Timeout</span>
              <input
                value={rule.timeout}
                onChange={(e) => onPatch({ timeout: e.target.value })}
                placeholder="5m"
                spellCheck={false}
                className={`${field} font-mono w-24`}
                aria-label="Approval timeout"
              />
              <span className={rowLabel}>Message</span>
              <input
                value={rule.message}
                onChange={(e) => onPatch({ message: e.target.value })}
                placeholder="shown to the approver"
                className={`${field} flex-1 min-w-0`}
                aria-label="Approval message"
              />
            </div>
            {rule.approvers.length > 0 && (
              <p className="text-[10px] text-gray-400">
                Anyone else is refused, but the kernel takes the approver&apos;s
                name from the request — this routes approvals, it doesn&apos;t
                authenticate them.
              </p>
            )}
          </div>
        )}

        {/* The kernel checks the limit before the decision, so it caps how often
            this rule fires regardless of what the rule then decides. */}
        {rule.rateLimit && (
          <div className="space-y-1.5 pl-2 border-l-2 border-blue-100 ml-1">
            <div className="flex items-center gap-2">
              <span className={rowLabel}>At most</span>
              <input
                value={rule.rateLimit.maxCalls}
                onChange={(e) => patchLimit({ maxCalls: e.target.value })}
                inputMode="numeric"
                placeholder="5"
                className={`${field} font-mono w-16`}
                aria-label="Max calls"
              />
              <span className="text-xs text-gray-400">calls every</span>
              <input
                value={rule.rateLimit.window}
                onChange={(e) => patchLimit({ window: e.target.value })}
                spellCheck={false}
                placeholder="1m"
                className={`${field} font-mono w-20`}
                aria-label="Rate limit window"
              />
              <select
                value={rule.rateLimit.perWhat}
                onChange={(e) =>
                  patchLimit({ perWhat: e.target.value as PerWhat })
                }
                className={field}
                aria-label="Rate limit scope"
              >
                {PER_WHATS.map((p) => (
                  <option key={p} value={p}>
                    {PER_WHAT_LABEL[p]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onPatch({ rateLimit: null })}
                className="text-gray-300 hover:text-gray-600 text-xs"
                aria-label="Remove rate limit"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className={rowLabel}>Wait up to</span>
              <input
                value={rule.rateLimit.maxWait}
                onChange={(e) => patchLimit({ maxWait: e.target.value })}
                spellCheck={false}
                placeholder="refuse right away"
                className={`${field} font-mono w-32`}
                aria-label="Max wait"
              />
              <span className="text-[10px] text-gray-400">
                a limited step parks and retries once, instead of being refused
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={rowLabel}>If broken</span>
              <select
                value={rule.rateLimit.onLimiterError}
                onChange={(e) =>
                  patchLimit({ onLimiterError: e.target.value as LimiterError })
                }
                className={field}
                aria-label="On limiter error"
              >
                {LIMITER_ERRORS.map((v) => (
                  <option key={v} value={v}>
                    {LIMITER_ERROR_LABEL[v]}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-gray-400">
                when the limiter itself is unavailable
              </span>
            </div>
          </div>
        )}

        {/* Counted across the whole execution, and only on a rule that allows. */}
        {rule.budget && (
          <div className="space-y-1.5 pl-2 border-l-2 border-purple-100 ml-1">
            <div className="flex items-center gap-2">
              <span className={rowLabel}>Budget</span>
              <input
                value={rule.budget.maxTokens}
                onChange={(e) => patchBudget({ maxTokens: e.target.value })}
                inputMode="numeric"
                placeholder="100000"
                className={`${field} font-mono w-24`}
                aria-label="Max tokens"
              />
              <span className="text-xs text-gray-400">
                tokens per execution, then
              </span>
              <select
                value={rule.budget.onExceed}
                onChange={(e) =>
                  patchBudget({ onExceed: e.target.value as OnExceed })
                }
                className={field}
                aria-label="On budget exceeded"
              >
                {ON_EXCEEDS.map((v) => (
                  <option key={v} value={v}>
                    {ON_EXCEED_LABEL[v]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onPatch({ budget: null })}
                className="text-gray-300 hover:text-gray-600 text-xs"
                aria-label="Remove budget"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!rule.rateLimit && (
            <button
              type="button"
              onClick={() => onPatch({ rateLimit: emptyRateLimit() })}
              className="text-xs text-blue-600 hover:underline py-0.5"
            >
              + add rate limit
            </button>
          )}
          {!rule.budget && (
            <button
              type="button"
              onClick={() => onPatch({ budget: emptyBudget() })}
              className="text-xs text-blue-600 hover:underline py-0.5"
            >
              + add budget
            </button>
          )}
        </div>

        {errors.map((m) => (
          <p key={m} className="text-xs text-red-600">
            {m}
          </p>
        ))}
        {warnings.map((m) => (
          <p key={m} className="text-xs text-amber-600">
            {m}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function PolicyEditor({
  agentId,
  bundle,
}: {
  agentId: string;
  bundle: string;
}) {
  // Parsed once: the agents list polls, and re-deriving state from props would
  // wipe an in-progress edit on every tick.
  const [parsed] = useState(() => parseBundle(bundle ?? ""));
  const [draft, setDraft] = useState<PolicyDraft>(() =>
    parsed.ok ? parsed.draft : emptyDraft(),
  );
  const [mode, setMode] = useState<"blocks" | "yaml">(
    parsed.ok ? "blocks" : "yaml",
  );
  const [rawYaml, setRawYaml] = useState(bundle ?? "");
  const [baseline, setBaseline] = useState(bundle ?? "");
  const [savedYaml, setSavedYaml] = useState(() =>
    parsed.ok ? serializeDraft(parsed.draft) : (bundle ?? ""),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [dragUid, setDragUid] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  useEffect(() => {
    if (pending === null) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) setPending(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [pending, saving]);

  const errors = validateDraft(draft);
  const warnings = lintDraft(draft);
  const errorCount = Object.values(errors).flat().length;
  const currentYaml = mode === "blocks" ? serializeDraft(draft) : rawYaml;
  const dirty = currentYaml !== savedYaml;

  function patchRule(ruleUid: string, patch: Partial<RuleDraft>) {
    setDraft((d) => ({
      ...d,
      rules: d.rules.map((r) => (r.uid === ruleUid ? { ...r, ...patch } : r)),
    }));
  }

  function switchMode(next: "blocks" | "yaml") {
    if (next === mode) return;
    if (next === "yaml") {
      setRawYaml(serializeDraft(draft));
      setMode("yaml");
      return;
    }
    const result = parseBundle(rawYaml);
    if (!result.ok) {
      setError(`Can't show this as blocks: ${result.reason}`);
      return;
    }
    setError("");
    setDraft(result.draft);
    setMode("blocks");
  }

  function review() {
    setError("");
    if (mode === "blocks") {
      setShowErrors(true);
      if (errorCount > 0) return;
    }
    setPending(currentYaml);
  }

  async function save() {
    if (pending === null) return;
    setSaving(true);
    try {
      await loadPolicy(agentId, pending);
      setSavedYaml(pending);
      setBaseline(pending);
      setPending(null);
      setShowErrors(false);
      setSaved(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save policy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Policy</span>
          <div className="flex rounded border border-gray-200 overflow-hidden">
            {(["blocks", "yaml"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`px-2 py-0.5 text-xs ${
                  mode === m
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {m === "blocks" ? "Blocks" : "YAML"}
              </button>
            ))}
          </div>
          {dirty && <span className="text-xs text-amber-600">unsaved</span>}
          {saved && !dirty && (
            <span className="text-xs text-green-600">saved</span>
          )}
        </div>
        <button
          type="button"
          onClick={review}
          disabled={!dirty || saving}
          className="bg-blue-600 text-white rounded px-3 py-1 text-xs hover:bg-blue-700 disabled:opacity-40"
        >
          Review &amp; save
        </button>
      </div>

      {pending !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-review-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setPending(null);
            }
          }}
        >
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div>
                <h2
                  id="policy-review-title"
                  className="text-base font-semibold text-gray-900"
                >
                  Review policy changes
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Review the changes for {agentId} before saving.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={saving}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                aria-label="Close policy review"
              >
                ×
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">
                  Current
                </div>
                <pre className="min-h-48 flex-1 overflow-auto whitespace-pre rounded border border-gray-200 bg-gray-50 p-3 font-mono text-[10px]">
                  {baseline.trim() || "(none)"}
                </pre>
              </div>
              <div className="flex min-h-0 min-w-0 flex-col">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">
                  New
                </div>
                <pre className="min-h-48 flex-1 overflow-auto whitespace-pre rounded border border-blue-200 bg-blue-50/40 p-3 font-mono text-[10px]">
                  {pending.trim()}
                </pre>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="border-t border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700"
              >
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={saving}
                autoFocus
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Accept & save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!parsed.ok && mode === "yaml" && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          This bundle has something the block editor can&apos;t represent, so
          it&apos;s shown as YAML rather than rewritten: {parsed.reason}
        </p>
      )}

      {mode === "blocks" ? (
        <div className="space-y-2">
          {draft.rules.length === 0 && (
            <p className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-md px-3 py-4 text-center">
              No rules — every step falls through to the default below.
            </p>
          )}
          {draft.rules.map((r, i) => (
            <RuleCard
              key={r.uid}
              rule={r}
              index={i}
              total={draft.rules.length}
              errors={showErrors ? (errors[r.uid] ?? []) : []}
              warnings={warnings[r.uid] ?? []}
              dragging={dragUid === r.uid}
              onPatch={(patch) => patchRule(r.uid, patch)}
              onRemove={() =>
                setDraft((d) => ({
                  ...d,
                  rules: d.rules.filter((x) => x.uid !== r.uid),
                }))
              }
              onMove={(to) =>
                setDraft((d) => ({ ...d, rules: move(d.rules, i, to) }))
              }
              onDragStart={() => setDragUid(r.uid)}
              onDragEnd={() => setDragUid(null)}
              onDragOver={() => {
                if (!dragUid || dragUid === r.uid) return;
                setDraft((d) => {
                  const from = d.rules.findIndex((x) => x.uid === dragUid);
                  return from === -1 || from === i
                    ? d
                    : { ...d, rules: move(d.rules, from, i) };
                });
              }}
            />
          ))}

          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({ ...d, rules: [...d.rules, emptyRule()] }))
            }
            className="w-full border border-dashed border-gray-300 rounded-md py-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          >
            + Add rule
          </button>

          {/* The default is literally what happens after the last rule, so it
              lives at the bottom of the same stack. */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-md bg-gray-50 px-3 py-2">
            <span className="text-xs text-gray-500">
              If no rule matches a tool or model call →
            </span>
            <select
              value={draft.defaultAction}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  defaultAction: e.target.value as PolicyDraft["defaultAction"],
                }))
              }
              className={field}
              aria-label="Default action"
            >
              <option value="deny">Deny</option>
              <option value="allow">Allow</option>
            </select>
          </div>
        </div>
      ) : (
        <textarea
          value={rawYaml}
          onChange={(e) => setRawYaml(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Tab") return;
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart, selectionEnd } = el;
            setRawYaml(
              rawYaml.slice(0, selectionStart) +
                "  " +
                rawYaml.slice(selectionEnd),
            );
            requestAnimationFrame(() => {
              el.selectionStart = el.selectionEnd = selectionStart + 2;
            });
          }}
          rows={16}
          spellCheck={false}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono"
          placeholder={"default_action: deny\nrules: []"}
        />
      )}

      {showErrors && errorCount > 0 && mode === "blocks" && (
        <p className="text-xs text-red-600">
          Fix {errorCount} problem{errorCount > 1 ? "s" : ""} before saving.
        </p>
      )}
      {error && pending === null && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
