import { dump, load } from "js-yaml";

export type Decision = "allow" | "deny" | "require_approval";
export type StepKind = "tool_call" | "llm_call" | "local";
export type ArgOp = "equals" | "contains" | "one_of" | "regex";
export type DefaultAction = "allow" | "deny";
export type PerWhat = "execution" | "agent" | "global";
export type LimiterError = "allow" | "deny";
export type OnExceed = "deny" | "require_approval";

export const DECISIONS: Decision[] = ["allow", "deny", "require_approval"];
export const STEP_KINDS: StepKind[] = ["tool_call", "llm_call", "local"];
export const ARG_OPS: ArgOp[] = ["equals", "contains", "one_of", "regex"];
export const PER_WHATS: PerWhat[] = ["execution", "agent", "global"];
export const LIMITER_ERRORS: LimiterError[] = ["allow", "deny"];
export const ON_EXCEEDS: OnExceed[] = ["deny", "require_approval"];

export interface ArgCondition {
  uid: string;
  key: string;
  op: ArgOp;
  value: string; // equals | contains | regex
  values: string[]; // one_of
}

/** maxTokens stays a string so a half-typed field is empty, not NaN. */
export interface Budget {
  maxTokens: string;
  onExceed: OnExceed;
}

/** maxCalls stays a string so a half-typed field is empty, not NaN. */
export interface RateLimit {
  maxCalls: string;
  window: string;
  perWhat: PerWhat;
  maxWait: string; // "" = refuse instead of parking the step
  onLimiterError: LimiterError;
}

/** A rule as edited. Its position in the list is its evaluation order. */
export interface RuleDraft {
  uid: string;
  id: string;
  stepKind: StepKind | null; // null = condition row absent
  targets: string[] | null;
  agentIds: string[] | null;
  args: ArgCondition[];
  decision: Decision;
  reason: string;
  approvers: string[];
  timeout: string;
  message: string;
  rateLimit: RateLimit | null; // null = no rate_limit block
  budget: Budget | null; // null = no budget block
}

export interface PolicyDraft {
  defaultAction: DefaultAction;
  rules: RuleDraft[];
}

export type ParseResult =
  | { ok: true; draft: PolicyDraft }
  | { ok: false; reason: string };

let seq = 0;
export function uid(): string {
  return `u${++seq}`;
}

export function emptyRule(): RuleDraft {
  return {
    uid: uid(),
    id: "",
    stepKind: null,
    targets: null,
    agentIds: null,
    args: [],
    decision: "allow",
    reason: "",
    approvers: [],
    timeout: "",
    message: "",
    rateLimit: null,
    budget: null,
  };
}

export function emptyRateLimit(): RateLimit {
  return {
    maxCalls: "",
    window: "",
    perWhat: "execution",
    maxWait: "",
    onLimiterError: "allow",
  };
}

export function emptyBudget(): Budget {
  return { maxTokens: "", onExceed: "deny" };
}

export function emptyDraft(): PolicyDraft {
  return { defaultAction: "deny", rules: [] };
}

export function isCatchAll(r: RuleDraft): boolean {
  return (
    r.stepKind === null &&
    !r.targets?.length &&
    !r.agentIds?.length &&
    r.args.length === 0
  );
}

function argsToYaml(
  args: ArgCondition[],
): Record<string, Record<string, unknown>> | undefined {
  const out: Record<string, Record<string, unknown>> = {};
  for (const a of args) {
    const key = a.key.trim();
    if (!key) continue;
    const pred = (out[key] ??= {});
    // A duplicate key+op would overwrite here; validateDraft reports it first.
    pred[a.op] = a.op === "one_of" ? a.values : a.value;
  }
  return Object.keys(out).length ? out : undefined;
}

function ruleToYaml(r: RuleDraft): Record<string, unknown> {
  const when: Record<string, unknown> = {};
  if (r.stepKind) when.step_kind = r.stepKind;
  // The engine has both `target` (string) and `targets` (list); that split is a
  // Go struct detail, so the UI keeps one token list and picks the spelling.
  if (r.targets?.length === 1) when.target = r.targets[0];
  else if (r.targets && r.targets.length > 1) when.targets = r.targets;
  if (r.agentIds?.length === 1) when.agent_id = r.agentIds[0];
  else if (r.agentIds && r.agentIds.length > 1) when.agent_ids = r.agentIds;
  const args = argsToYaml(r.args);
  if (args) when.arguments = args;

  const then: Record<string, unknown> = { decision: r.decision };
  if (r.reason.trim()) then.reason = r.reason.trim();
  if (r.decision === "require_approval") {
    const ac: Record<string, unknown> = {};
    if (r.approvers.length) ac.approvers = r.approvers;
    if (r.timeout.trim()) ac.timeout = r.timeout.trim();
    if (r.message.trim()) ac.message = r.message.trim();
    if (Object.keys(ac).length) then.approval_config = ac;
  }
  if (r.rateLimit) {
    const rl: Record<string, unknown> = {
      max_calls: Number(r.rateLimit.maxCalls),
      window: r.rateLimit.window.trim(),
    };
    // "execution" and fail-open are the engine's defaults, so leave them implicit.
    if (r.rateLimit.perWhat !== "execution") rl.per_what = r.rateLimit.perWhat;
    if (r.rateLimit.maxWait.trim()) rl.max_wait = r.rateLimit.maxWait.trim();
    if (r.rateLimit.onLimiterError !== "allow")
      rl.on_limiter_error = r.rateLimit.onLimiterError;
    then.rate_limit = rl;
  }
  if (r.budget) {
    const b: Record<string, unknown> = {
      max_tokens: Number(r.budget.maxTokens),
    };
    // Anything but require_approval denies, so leave the deny case implicit.
    if (r.budget.onExceed !== "deny") b.on_exceed = r.budget.onExceed;
    then.budget = b;
  }

  const out: Record<string, unknown> = { id: r.id.trim() };
  // An omitted `when` is the zero Condition, which matches every step — same as
  // `when: {}` but without implying a constraint exists.
  if (Object.keys(when).length) out.when = when;
  out.then = then;
  return out;
}

export function serializeDraft(d: PolicyDraft): string {
  const doc = {
    default_action: d.defaultAction,
    rules: d.rules.map(ruleToYaml),
  };
  return dump(doc, { lineWidth: -1, noRefs: true, quoteStyle: "single" });
}

const ROOT_KEYS = new Set(["default_action", "rules"]);
const RULE_KEYS = new Set(["id", "when", "then"]);
const WHEN_KEYS = new Set([
  "target",
  "targets",
  "agent_id",
  "agent_ids",
  "step_kind",
  "arguments",
]);
const THEN_KEYS = new Set([
  "decision",
  "reason",
  "approval_config",
  "rate_limit",
  "budget",
]);
const APPROVAL_KEYS = new Set(["approvers", "timeout", "message"]);
const BUDGET_KEYS = new Set(["max_tokens", "on_exceed"]);
const RATE_LIMIT_KEYS = new Set([
  "max_calls",
  "window",
  "per_what",
  "max_wait",
  "on_limiter_error",
]);

function asObject(v: unknown, what: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error(`${what} must be a mapping`);
  return v as Record<string, unknown>;
}

function rejectUnknown(
  o: Record<string, unknown>,
  allowed: Set<string>,
  what: string,
) {
  const bad = Object.keys(o).filter((k) => !allowed.has(k));
  if (bad.length)
    throw new Error(
      `${what}: unsupported field ${bad.map((b) => `"${b}"`).join(", ")}`,
    );
}

function asString(v: unknown, what: string): string {
  if (typeof v !== "string") throw new Error(`${what} must be a string`);
  return v;
}

function asStringList(v: unknown, what: string): string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new Error(`${what} must be a list of strings`);
  }
  return v as string[];
}

function toArgs(raw: unknown, where: string): ArgCondition[] {
  const m = asObject(raw, `${where} arguments`);
  const out: ArgCondition[] = [];
  for (const [key, predRaw] of Object.entries(m)) {
    const pred = asObject(predRaw, `${where} argument "${key}"`);
    rejectUnknown(pred, new Set(ARG_OPS), `${where} argument "${key}"`);
    const ops = ARG_OPS.filter((op) => pred[op] !== undefined);
    if (!ops.length)
      throw new Error(`${where}: argument "${key}" has no constraint`);
    for (const op of ops) {
      // The engine ANDs every constraint on a key, so each becomes its own row.
      out.push({
        uid: uid(),
        key,
        op,
        value:
          op === "one_of"
            ? ""
            : asString(pred[op], `${where} argument "${key}" ${op}`),
        values:
          op === "one_of"
            ? asStringList(pred[op], `${where} argument "${key}" one_of`)
            : [],
      });
    }
  }
  return out;
}

function toRateLimit(raw: unknown, where: string): RateLimit {
  const rl = asObject(raw, `${where} rate_limit`);
  rejectUnknown(rl, RATE_LIMIT_KEYS, `${where} rate_limit`);

  if (typeof rl.max_calls !== "number" || !Number.isInteger(rl.max_calls)) {
    throw new Error(`${where}: rate_limit max_calls must be a whole number`);
  }
  // yaml.v3 reads a bare number into time.Duration as *nanoseconds*, so
  // `window: 60` means 60ns, not a minute. Only the string form is offered here;
  // a numeric one goes to the raw editor rather than get silently reinterpreted.
  const window = asString(rl.window, `${where} rate_limit window`);

  // Same nanosecond trap as window; unset means refuse rather than park.
  const maxWait =
    rl.max_wait === undefined
      ? ""
      : asString(rl.max_wait, `${where} rate_limit max_wait`);

  let perWhat: PerWhat = "execution";
  if (rl.per_what !== undefined) {
    const p = asString(rl.per_what, `${where} rate_limit per_what`);
    // ScopeKey treats anything unrecognised as "execution"; don't paper over it.
    if (!PER_WHATS.includes(p as PerWhat)) {
      throw new Error(
        `${where}: rate_limit per_what must be ${PER_WHATS.join(", ")}`,
      );
    }
    perWhat = p as PerWhat;
  }

  let onLimiterError: LimiterError = "allow";
  if (rl.on_limiter_error !== undefined) {
    const e = asString(
      rl.on_limiter_error,
      `${where} rate_limit on_limiter_error`,
    );
    if (!LIMITER_ERRORS.includes(e as LimiterError)) {
      throw new Error(
        `${where}: rate_limit on_limiter_error must be allow or deny`,
      );
    }
    onLimiterError = e as LimiterError;
  }

  return {
    maxCalls: String(rl.max_calls),
    window,
    perWhat,
    maxWait,
    onLimiterError,
  };
}

function toBudget(raw: unknown, where: string): Budget {
  const b = asObject(raw, `${where} budget`);
  rejectUnknown(b, BUDGET_KEYS, `${where} budget`);

  if (typeof b.max_tokens !== "number" || !Number.isInteger(b.max_tokens)) {
    throw new Error(`${where}: budget max_tokens must be a whole number`);
  }

  let onExceed: OnExceed = "deny";
  if (b.on_exceed !== undefined) {
    const e = asString(b.on_exceed, `${where} budget on_exceed`);
    // The kernel reads only require_approval and denies on everything else;
    // don't let a typo look like a softer setting than it is.
    if (!ON_EXCEEDS.includes(e as OnExceed)) {
      throw new Error(
        `${where}: budget on_exceed must be deny or require_approval`,
      );
    }
    onExceed = e as OnExceed;
  }

  return { maxTokens: String(b.max_tokens), onExceed };
}

function toRule(raw: unknown, i: number): RuleDraft {
  const where = `rule ${i + 1}`;
  const r = asObject(raw, where);
  rejectUnknown(r, RULE_KEYS, where);

  const when =
    r.when === undefined || r.when === null
      ? {}
      : asObject(r.when, `${where} when`);
  rejectUnknown(when, WHEN_KEYS, `${where} when`);

  let stepKind: StepKind | null = null;
  if (when.step_kind !== undefined) {
    const sk = asString(when.step_kind, `${where} step_kind`);
    if (!(STEP_KINDS as string[]).includes(sk)) {
      throw new Error(
        `${where}: step_kind must be one of ${STEP_KINDS.join(", ")}`,
      );
    }
    stepKind = sk as StepKind;
  }

  // `target` and `targets` together AND in the engine; one token list can only
  // express OR, so hand those bundles to the raw editor rather than reinterpret.
  if (when.target !== undefined && when.targets !== undefined) {
    throw new Error(`${where}: uses both "target" and "targets"`);
  }
  if (when.agent_id !== undefined && when.agent_ids !== undefined) {
    throw new Error(`${where}: uses both "agent_id" and "agent_ids"`);
  }

  let targets: string[] | null = null;
  if (when.target !== undefined)
    targets = [asString(when.target, `${where} target`)];
  else if (when.targets !== undefined)
    targets = asStringList(when.targets, `${where} targets`);

  let agentIds: string[] | null = null;
  if (when.agent_id !== undefined)
    agentIds = [asString(when.agent_id, `${where} agent_id`)];
  else if (when.agent_ids !== undefined)
    agentIds = asStringList(when.agent_ids, `${where} agent_ids`);

  const args =
    when.arguments === undefined ? [] : toArgs(when.arguments, where);

  const then =
    r.then === undefined || r.then === null
      ? {}
      : asObject(r.then, `${where} then`);
  rejectUnknown(then, THEN_KEYS, `${where} then`);
  const decision = asString(then.decision, `${where} decision`);
  if (!DECISIONS.includes(decision as Decision)) {
    throw new Error(
      `${where}: decision must be allow, deny or require_approval`,
    );
  }

  let approvers: string[] = [];
  let timeout = "";
  let message = "";
  if (then.approval_config !== undefined) {
    const ac = asObject(then.approval_config, `${where} approval_config`);
    rejectUnknown(ac, APPROVAL_KEYS, `${where} approval_config`);
    if (ac.approvers !== undefined)
      approvers = asStringList(ac.approvers, `${where} approvers`);
    if (ac.timeout !== undefined)
      timeout = asString(ac.timeout, `${where} timeout`);
    if (ac.message !== undefined)
      message = asString(ac.message, `${where} message`);
  }

  return {
    uid: uid(),
    id: r.id === undefined ? "" : asString(r.id, `${where} id`),
    stepKind,
    targets,
    agentIds,
    args,
    decision: decision as Decision,
    reason:
      then.reason === undefined ? "" : asString(then.reason, `${where} reason`),
    approvers,
    timeout,
    message,
    rateLimit:
      then.rate_limit === undefined
        ? null
        : toRateLimit(then.rate_limit, where),
    budget: then.budget === undefined ? null : toBudget(then.budget, where),
  };
}

export function parseBundle(text: string): ParseResult {
  if (!text.trim()) return { ok: true, draft: emptyDraft() };

  let doc: unknown;
  try {
    doc = load(text);
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "invalid YAML",
    };
  }

  try {
    const root = asObject(doc, "bundle");
    rejectUnknown(root, ROOT_KEYS, "bundle");

    let defaultAction: DefaultAction = "deny";
    if (root.default_action !== undefined) {
      const da = asString(root.default_action, "default_action");
      if (da !== "allow" && da !== "deny")
        throw new Error(`default_action must be "allow" or "deny"`);
      defaultAction = da;
    }

    const rawRules =
      root.rules === undefined || root.rules === null ? [] : root.rules;
    if (!Array.isArray(rawRules)) throw new Error("rules must be a list");

    // Document order is evaluation order, so the list reads top to bottom.
    return {
      ok: true,
      draft: { defaultAction, rules: rawRules.map(toRule) },
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "unsupported bundle",
    };
  }
}

// Go's time.ParseDuration. An unparseable timeout would fail the bundle load.
const DURATION_RE = /^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$/;

function push(bag: Record<string, string[]>, key: string, msg: string) {
  (bag[key] ??= []).push(msg);
}

export function validateDraft(d: PolicyDraft): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const ids = new Map<string, number>();
  d.rules.forEach((r, i) => {
    const id = r.id.trim();
    if (!id)
      push(
        errors,
        r.uid,
        "Needs an id — the kernel rejects a bundle with an unnamed rule.",
      );
    else {
      const prev = ids.get(id);
      if (prev === undefined) ids.set(id, i);
      else
        push(
          errors,
          r.uid,
          `Duplicate id — rule ${prev + 1} uses "${id}" too, and the kernel rejects a bundle with two rules sharing an id.`,
        );
    }
    if (r.targets !== null && r.targets.length === 0)
      push(errors, r.uid, "Target condition has no value.");
    if (r.agentIds !== null && r.agentIds.length === 0)
      push(errors, r.uid, "Agent condition has no value.");

    const seenOps = new Set<string>();
    for (const a of r.args) {
      if (!a.key.trim()) {
        push(errors, r.uid, "Argument condition has no name.");
        continue;
      }
      const sig = `${a.key.trim()}:${a.op}`;
      if (seenOps.has(sig))
        push(
          errors,
          r.uid,
          `Argument "${a.key.trim()}" has two "${a.op}" constraints.`,
        );
      seenOps.add(sig);
      const empty = a.op === "one_of" ? a.values.length === 0 : !a.value;
      if (empty)
        push(
          errors,
          r.uid,
          `Argument "${a.key.trim()}" needs a value — the engine ignores an empty one.`,
        );
    }

    if (
      r.decision === "require_approval" &&
      r.timeout.trim() &&
      !DURATION_RE.test(r.timeout.trim())
    ) {
      push(
        errors,
        r.uid,
        `Timeout "${r.timeout.trim()}" is not a duration (e.g. 30s, 5m, 1h30m).`,
      );
    }

    // The limiter no-ops unless both max_calls and window are > 0, so half a
    // rate limit is no rate limit — worth blocking rather than shipping.
    if (r.rateLimit) {
      const n = Number(r.rateLimit.maxCalls);
      if (!r.rateLimit.maxCalls.trim() || !Number.isInteger(n) || n < 1) {
        push(
          errors,
          r.uid,
          "Rate limit needs a whole max calls of 1 or more, or the limit does nothing.",
        );
      }
      const w = r.rateLimit.window.trim();
      if (!w)
        push(
          errors,
          r.uid,
          "Rate limit needs a window, or the limit does nothing.",
        );
      else if (!DURATION_RE.test(w))
        push(
          errors,
          r.uid,
          `Rate limit window "${w}" is not a duration (e.g. 1m, 1h).`,
        );

      const mw = r.rateLimit.maxWait.trim();
      if (mw && !DURATION_RE.test(mw))
        push(
          errors,
          r.uid,
          `Max wait "${mw}" is not a duration (e.g. 30s, 5m).`,
        );
    }

    // The kernel skips the budget check unless max_tokens is > 0.
    if (r.budget) {
      const n = Number(r.budget.maxTokens);
      if (!r.budget.maxTokens.trim() || !Number.isInteger(n) || n < 1) {
        push(
          errors,
          r.uid,
          "Budget needs a whole max tokens of 1 or more, or the budget does nothing.",
        );
      }
    }
  });
  return errors;
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function sameArg(x: ArgCondition, y: ArgCondition): boolean {
  if (x.key.trim() !== y.key.trim() || x.op !== y.op) return false;
  return x.op === "one_of" ? sameSet(x.values, y.values) : x.value === y.value;
}

/**
 * True when every step matching `b` also matches `a`, so `a` placed above `b`
 * leaves `b` dead. Deliberately conservative: an absent condition on `a` is
 * unconstrained (broader), and target sets must be a literal superset. No glob
 * or regex reasoning, which keeps this free of false positives — wrongly
 * claiming a rule is dead is worse than staying quiet.
 */
function subsumes(a: RuleDraft, b: RuleDraft): boolean {
  if (a.stepKind !== null && a.stepKind !== b.stepKind) return false;
  if (
    a.targets !== null &&
    (b.targets === null || !b.targets.every((t) => a.targets!.includes(t)))
  )
    return false;
  if (
    a.agentIds !== null &&
    (b.agentIds === null || !b.agentIds.every((t) => a.agentIds!.includes(t)))
  )
    return false;
  return a.args.every((x) => b.args.some((y) => sameArg(x, y)));
}

/** Advisory problems: rules that can never fire. */
export function lintDraft(d: PolicyDraft): Record<string, string[]> {
  const warnings: Record<string, string[]> = {};

  d.rules.forEach((r, i) => {
    const shadow = d.rules.findIndex((o, j) => j < i && subsumes(o, r));
    if (shadow !== -1) {
      const s = d.rules[shadow];
      push(
        warnings,
        r.uid,
        `Never runs — rule ${shadow + 1} ("${s.id || "unnamed"}") above already matches every step this matches.`,
      );
    }
    if (isCatchAll(r) && i < d.rules.length - 1) {
      push(
        warnings,
        r.uid,
        `Matches every step, so the ${d.rules.length - 1 - i} rule(s) below never run.`,
      );
    }

    // The kernel checks the budget only on a rule that allows.
    if (r.budget && r.decision !== "allow") {
      push(
        warnings,
        r.uid,
        `Budget is ignored — it only applies to a rule that allows.`,
      );
    }
  });

  return warnings;
}
