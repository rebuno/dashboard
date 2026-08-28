import { describe, expect, it } from "vitest";
import {
  emptyRule,
  lintDraft,
  parseBundle,
  serializeDraft,
  validateDraft,
  type PolicyDraft,
  type RuleDraft,
} from "./policy";

// Verbatim from rebuno/examples/policies/shell.yaml.
const SHELL_BUNDLE = `default_action: deny
rules:
  - id: allow-llm
    when:
      step_kind: llm_call
    then:
      decision: allow
  - id: allow-safe-shell
    when:
      target: shell_exec
      arguments:
        command:
          regex: '^\\s*(ls|cat|pwd|echo|whoami|date|uname|df|free|uptime|head|tail|wc)(\\s|$)'
    then:
      decision: allow
      reason: safe read-only command
  - id: approve-other-shell
    when:
      target: shell_exec
    then:
      decision: require_approval
      reason: non-safe shell command needs approval
`;

function ok(text: string): PolicyDraft {
  const r = parseBundle(text);
  if (!r.ok) throw new Error(`expected parse to succeed: ${r.reason}`);
  return r.draft;
}

function rule(over: Partial<RuleDraft>): RuleDraft {
  return { ...emptyRule(), ...over };
}

describe("parseBundle", () => {
  it("parses the real shell.yaml example", () => {
    const d = ok(SHELL_BUNDLE);
    expect(d.defaultAction).toBe("deny");
    expect(d.rules.map((r) => r.id)).toEqual([
      "allow-llm",
      "allow-safe-shell",
      "approve-other-shell",
    ]);
    expect(d.rules[0].stepKind).toBe("llm_call");
    expect(d.rules[1].targets).toEqual(["shell_exec"]);
    expect(d.rules[1].args[0]).toMatchObject({ key: "command", op: "regex" });
    expect(d.rules[2].decision).toBe("require_approval");
  });

  it("keeps document order — list order is eval order", () => {
    const d = ok(`
rules:
  - id: first
    then: { decision: deny }
  - id: second
    then: { decision: allow }
`);
    expect(d.rules.map((r) => r.id)).toEqual(["first", "second"]);
  });

  it("parses flow-style mappings used in the docs", () => {
    const d = ok(
      `rules:\n  - id: a\n    when: { step_kind: llm_call }\n    then: { decision: allow }\n`,
    );
    expect(d.rules[0].stepKind).toBe("llm_call");
  });

  it("treats an empty bundle as a new deny-by-default policy", () => {
    expect(ok("")).toEqual({ defaultAction: "deny", rules: [] });
  });

  it("reads approval_config", () => {
    const d = ok(`
rules:
  - id: a
    then:
      decision: require_approval
      approval_config:
        approvers: ["alice", "bob"]
        timeout: 5m
        message: review please
`);
    expect(d.rules[0]).toMatchObject({
      approvers: ["alice", "bob"],
      timeout: "5m",
      message: "review please",
    });
  });

  it("reads rate_limit, defaulting scope and limiter-error to the engine's own defaults", () => {
    const d = ok(`
rules:
  - id: a
    then:
      decision: allow
      rate_limit:
        max_calls: 5
        window: 1m
  - id: b
    then:
      decision: deny
      rate_limit:
        max_calls: 1
        window: 1h
        per_what: global
        on_limiter_error: deny
`);
    expect(d.rules[0].rateLimit).toEqual({
      maxCalls: "5",
      window: "1m",
      perWhat: "execution",
      maxWait: "",
      onLimiterError: "allow",
    });
    expect(d.rules[1].rateLimit).toEqual({
      maxCalls: "1",
      window: "1h",
      perWhat: "global",
      maxWait: "",
      onLimiterError: "deny",
    });
  });

  it("reads max_wait, which parks a limited step instead of refusing it", () => {
    const d = ok(`
rules:
  - id: a
    then:
      decision: allow
      rate_limit:
        max_calls: 5
        window: 1m
        max_wait: 30s
`);
    expect(d.rules[0].rateLimit?.maxWait).toBe("30s");
  });

  it("reads budget, defaulting on_exceed to the engine's own deny", () => {
    const d = ok(`
rules:
  - id: a
    then:
      decision: allow
      budget:
        max_tokens: 100000
  - id: b
    then:
      decision: allow
      budget:
        max_tokens: 500
        on_exceed: require_approval
`);
    expect(d.rules[0].budget).toEqual({
      maxTokens: "100000",
      onExceed: "deny",
    });
    expect(d.rules[1].budget).toEqual({
      maxTokens: "500",
      onExceed: "require_approval",
    });
  });

  // Falling back to the raw editor is safe; silently dropping a rule is not.
  it.each([
    ["unknown root key", "default_action: deny\nbogus: 1\nrules: []\n"],
    [
      "unknown when key",
      "rules:\n  - id: a\n    when: { tool: x }\n    then: { decision: allow }\n",
    ],
    [
      "unknown then key",
      "rules:\n  - id: a\n    then: { decision: allow, retry: 3 }\n",
    ],
    [
      "unknown rate_limit key",
      "rules:\n  - id: a\n    then: { decision: allow, rate_limit: { max_calls: 5, window: 1m, burst: 2 } }\n",
    ],
    // yaml.v3 reads a bare number into time.Duration as nanoseconds, so `60`
    // means 60ns. Reinterpreting that as a minute would be a silent rewrite.
    [
      "numeric rate_limit window",
      "rules:\n  - id: a\n    then: { decision: allow, rate_limit: { max_calls: 5, window: 60 } }\n",
    ],
    [
      "unknown per_what",
      "rules:\n  - id: a\n    then: { decision: allow, rate_limit: { max_calls: 5, window: 1m, per_what: user } }\n",
    ],
    [
      "unknown on_limiter_error",
      "rules:\n  - id: a\n    then: { decision: allow, rate_limit: { max_calls: 5, window: 1m, on_limiter_error: retry } }\n",
    ],
    // yaml.v3 reads a bare number into time.Duration as nanoseconds, same trap
    // as window.
    [
      "numeric max_wait",
      "rules:\n  - id: a\n    then: { decision: allow, rate_limit: { max_calls: 5, window: 1m, max_wait: 30 } }\n",
    ],
    [
      "unknown budget key",
      "rules:\n  - id: a\n    then: { decision: allow, budget: { max_tokens: 100, refill: 1m } }\n",
    ],
    [
      "unknown on_exceed",
      "rules:\n  - id: a\n    then: { decision: allow, budget: { max_tokens: 100, on_exceed: warn } }\n",
    ],
    [
      "fractional max_tokens",
      "rules:\n  - id: a\n    then: { decision: allow, budget: { max_tokens: 1.5 } }\n",
    ],
    [
      "unknown arg op",
      "rules:\n  - id: a\n    when:\n      arguments:\n        c: { starts_with: rm }\n    then: { decision: allow }\n",
    ],
    [
      "target and targets together",
      "rules:\n  - id: a\n    when: { target: x, targets: [y] }\n    then: { decision: allow }\n",
    ],
    ["bad decision", "rules:\n  - id: a\n    then: { decision: maybe }\n"],
    [
      "bad step_kind",
      "rules:\n  - id: a\n    when: { step_kind: rpc }\n    then: { decision: allow }\n",
    ],
    ["malformed yaml", "rules: [\n"],
  ])("rejects rather than mangles: %s", (_name, text) => {
    expect(parseBundle(text).ok).toBe(false);
  });
});

describe("serializeDraft", () => {
  it("round-trips the shell example without semantic drift", () => {
    const once = serializeDraft(ok(SHELL_BUNDLE));
    expect(serializeDraft(ok(once))).toBe(once);
  });

  it("preserves the regex exactly through a round-trip", () => {
    const original = ok(SHELL_BUNDLE).rules[1].args[0].value;
    const reparsed = ok(serializeDraft(ok(SHELL_BUNDLE))).rules[1].args[0]
      .value;
    expect(reparsed).toBe(original);
    expect(reparsed).toContain("\\s*(ls|cat");
  });

  it("reordering rules reorders the document, which is the order of evaluation", () => {
    const d = ok(SHELL_BUNDLE);
    d.rules.reverse();
    expect(ok(serializeDraft(d)).rules.map((r) => r.id)).toEqual([
      "approve-other-shell",
      "allow-safe-shell",
      "allow-llm",
    ]);
  });

  it("emits target for one value and targets for several", () => {
    expect(
      serializeDraft({
        defaultAction: "deny",
        rules: [rule({ id: "a", targets: ["x"] })],
      }),
    ).toContain("target: x");
    const many = serializeDraft({
      defaultAction: "deny",
      rules: [rule({ id: "a", targets: ["x", "y"] })],
    });
    expect(many).toContain("targets:");
    expect(ok(many).rules[0].targets).toEqual(["x", "y"]);
  });

  it("omits when for a catch-all rule and drops approval_config unless approving", () => {
    const out = serializeDraft({
      defaultAction: "deny",
      rules: [rule({ id: "a", approvers: ["x"] })],
    });
    expect(out).not.toContain("when:");
    expect(out).not.toContain("approval_config");
  });

  it("round-trips a rate limit and omits the two engine defaults", () => {
    const d: PolicyDraft = {
      defaultAction: "deny",
      rules: [
        rule({
          id: "a",
          rateLimit: {
            maxCalls: "5",
            window: "1m",
            perWhat: "execution",
            maxWait: "",
            onLimiterError: "allow",
          },
        }),
      ],
    };
    const out = serializeDraft(d);
    expect(out).not.toContain("per_what");
    expect(out).not.toContain("on_limiter_error");
    // max_calls must survive as a YAML int; a quoted "5" fails the Go load.
    expect(out).toContain("max_calls: 5");
    expect(ok(out).rules[0].rateLimit).toEqual(d.rules[0].rateLimit);
  });

  it("omits an unset max_wait so the engine keeps refusing", () => {
    const d: PolicyDraft = {
      defaultAction: "deny",
      rules: [
        rule({
          id: "a",
          rateLimit: {
            maxCalls: "5",
            window: "1m",
            perWhat: "execution",
            maxWait: "",
            onLimiterError: "allow",
          },
        }),
      ],
    };
    expect(serializeDraft(d)).not.toContain("max_wait");
  });

  it("round-trips a max_wait", () => {
    const d: PolicyDraft = {
      defaultAction: "deny",
      rules: [
        rule({
          id: "a",
          rateLimit: {
            maxCalls: "5",
            window: "1m",
            perWhat: "execution",
            maxWait: "30s",
            onLimiterError: "allow",
          },
        }),
      ],
    };
    expect(ok(serializeDraft(d)).rules[0].rateLimit).toEqual(
      d.rules[0].rateLimit,
    );
  });

  it("emits a non-default scope and limiter-error", () => {
    const d: PolicyDraft = {
      defaultAction: "deny",
      rules: [
        rule({
          id: "a",
          rateLimit: {
            maxCalls: "1",
            window: "1h",
            perWhat: "agent",
            maxWait: "",
            onLimiterError: "deny",
          },
        }),
      ],
    };
    expect(ok(serializeDraft(d)).rules[0].rateLimit).toEqual(
      d.rules[0].rateLimit,
    );
  });

  it("keeps a rate limit on a non-allow rule — the engine checks it before the decision", () => {
    const d: PolicyDraft = {
      defaultAction: "allow",
      rules: [
        rule({
          id: "a",
          decision: "deny",
          rateLimit: {
            maxCalls: "2",
            window: "1m",
            perWhat: "execution",
            maxWait: "",
            onLimiterError: "allow",
          },
        }),
      ],
    };
    expect(serializeDraft(d)).toContain("rate_limit");
  });

  it("round-trips a budget and omits the default on_exceed", () => {
    const d: PolicyDraft = {
      defaultAction: "deny",
      rules: [
        rule({ id: "a", budget: { maxTokens: "100000", onExceed: "deny" } }),
      ],
    };
    const out = serializeDraft(d);
    expect(out).not.toContain("on_exceed");
    // max_tokens must survive as a YAML int; a quoted "100000" fails the Go load.
    expect(out).toContain("max_tokens: 100000");
    expect(ok(out).rules[0].budget).toEqual(d.rules[0].budget);
  });

  it("emits a non-default on_exceed", () => {
    const d: PolicyDraft = {
      defaultAction: "deny",
      rules: [
        rule({
          id: "a",
          budget: { maxTokens: "500", onExceed: "require_approval" },
        }),
      ],
    };
    expect(ok(serializeDraft(d)).rules[0].budget).toEqual(d.rules[0].budget);
  });

  it("merges multiple constraints on one argument key back into one predicate", () => {
    const d: PolicyDraft = {
      defaultAction: "deny",
      rules: [
        rule({
          id: "a",
          args: [
            { uid: "1", key: "cmd", op: "contains", value: "rm", values: [] },
            { uid: "2", key: "cmd", op: "regex", value: "^rm", values: [] },
          ],
        }),
      ],
    };
    expect(ok(serializeDraft(d)).rules[0].args).toHaveLength(2);
  });
});

describe("validateDraft", () => {
  it("accepts the shell example", () => {
    expect(validateDraft(ok(SHELL_BUNDLE))).toEqual({});
  });

  it("blocks a rule with no id", () => {
    const r = rule({ id: "" });
    expect(
      validateDraft({ defaultAction: "deny", rules: [r] })[r.uid][0],
    ).toMatch(/id/);
  });

  // matchArguments skips an empty constraint, so this widens the rule silently.
  it("blocks an empty argument value", () => {
    const r = rule({
      id: "a",
      args: [{ uid: "1", key: "cmd", op: "equals", value: "", values: [] }],
    });
    expect(
      validateDraft({ defaultAction: "deny", rules: [r] })[r.uid][0],
    ).toMatch(/needs a value/);
  });

  it("blocks an empty condition row and a bad duration", () => {
    const empty = rule({ id: "a", targets: [] });
    expect(
      validateDraft({ defaultAction: "deny", rules: [empty] })[empty.uid],
    ).toHaveLength(1);
    const bad = rule({
      id: "b",
      decision: "require_approval",
      timeout: "5 minutes",
    });
    expect(
      validateDraft({ defaultAction: "deny", rules: [bad] })[bad.uid][0],
    ).toMatch(/not a duration/);
  });

  it("accepts Go compound durations", () => {
    const r = rule({ id: "a", decision: "require_approval", timeout: "1h30m" });
    expect(validateDraft({ defaultAction: "deny", rules: [r] })).toEqual({});
  });

  // The limiter no-ops unless both are > 0, so half a rate limit is no limit.
  it.each([
    ["no max calls", { maxCalls: "", window: "1m" }, /max calls/],
    ["zero max calls", { maxCalls: "0", window: "1m" }, /max calls/],
    ["fractional max calls", { maxCalls: "2.5", window: "1m" }, /max calls/],
    ["no window", { maxCalls: "5", window: "" }, /needs a window/],
    ["bad window", { maxCalls: "5", window: "1 minute" }, /not a duration/],
  ])("blocks a rate limit with %s", (_name, over, want) => {
    const r = rule({
      id: "a",
      rateLimit: {
        perWhat: "execution",
        maxWait: "",
        onLimiterError: "allow",
        ...over,
      } as RuleDraft["rateLimit"],
    });
    expect(
      validateDraft({ defaultAction: "deny", rules: [r] })[r.uid][0],
    ).toMatch(want);
  });

  // The kernel skips the check unless max_tokens is > 0.
  it.each([
    ["no max tokens", ""],
    ["zero max tokens", "0"],
    ["fractional max tokens", "2.5"],
  ])("blocks a budget with %s", (_name, maxTokens) => {
    const r = rule({ id: "a", budget: { maxTokens, onExceed: "deny" } });
    expect(
      validateDraft({ defaultAction: "deny", rules: [r] })[r.uid][0],
    ).toMatch(/max tokens/);
  });

  it("blocks a max wait that is not a duration", () => {
    const r = rule({
      id: "a",
      rateLimit: {
        maxCalls: "5",
        window: "1m",
        perWhat: "execution",
        maxWait: "half an hour",
        onLimiterError: "allow",
      },
    });
    expect(
      validateDraft({ defaultAction: "deny", rules: [r] })[r.uid][0],
    ).toMatch(/Max wait/);
  });

  it("accepts a complete rate limit", () => {
    const r = rule({
      id: "a",
      rateLimit: {
        maxCalls: "5",
        window: "1m",
        perWhat: "agent",
        maxWait: "",
        onLimiterError: "deny",
      },
    });
    expect(validateDraft({ defaultAction: "deny", rules: [r] })).toEqual({});
  });
});

describe("lintDraft", () => {
  it("stays quiet on a well-ordered bundle", () => {
    expect(lintDraft(ok(SHELL_BUNDLE))).toEqual({});
  });

  it("flags rules shadowed by an earlier catch-all", () => {
    const catchAll = rule({ id: "allow-all" });
    const dead = rule({
      id: "deny-shell",
      targets: ["shell_exec"],
      decision: "deny",
    });
    const w = lintDraft({ defaultAction: "deny", rules: [catchAll, dead] });
    expect(w[catchAll.uid][0]).toMatch(/never run/);
    expect(w[dead.uid][0]).toMatch(/Never runs/);
  });

  it("does not flag a catch-all that is last", () => {
    const catchAll = rule({ id: "fallback" });
    expect(
      lintDraft({
        defaultAction: "deny",
        rules: [rule({ id: "a", targets: ["x"] }), catchAll],
      }),
    ).toEqual({});
  });

  it("flags identical conditions and duplicate ids", () => {
    const a = rule({ id: "a", targets: ["x"] });
    const b = rule({ id: "a", targets: ["x"], decision: "deny" });
    const w = lintDraft({ defaultAction: "deny", rules: [a, b] });
    expect(w[b.uid].some((m) => /Never runs/.test(m))).toBe(true);
    expect(w[b.uid].some((m) => /Duplicate id/.test(m))).toBe(true);
  });

  // ScopeKey is rule_id + scope, so a duplicate id silently merges two buckets.
  it("says so when duplicate ids would share a rate-limit bucket", () => {
    const a = rule({
      id: "dup",
      targets: ["x"],
      rateLimit: {
        maxCalls: "5",
        window: "1m",
        perWhat: "execution",
        maxWait: "",
        onLimiterError: "allow",
      },
    });
    const b = rule({ id: "dup", targets: ["y"] });
    const w = lintDraft({ defaultAction: "deny", rules: [a, b] });
    expect(w[b.uid].some((m) => /share one rate-limit bucket/.test(m))).toBe(
      true,
    );
  });

  // The kernel checks the budget only after the rule has decided to allow.
  it("says a budget on a non-allow rule is ignored", () => {
    const a = rule({
      id: "a",
      targets: ["x"],
      decision: "require_approval",
      budget: { maxTokens: "100", onExceed: "deny" },
    });
    expect(lintDraft({ defaultAction: "deny", rules: [a] })[a.uid][0]).toMatch(
      /Budget is ignored/,
    );
  });

  // The real footgun: dragging the broad approval rule above the narrow allow
  // rule means safe commands can never be auto-allowed again.
  it("flags a narrower rule shadowed by a broader one on the same target", () => {
    const broad = rule({
      id: "approve-other-shell",
      targets: ["shell_exec"],
      decision: "require_approval",
    });
    const narrow = rule({
      id: "allow-safe-shell",
      targets: ["shell_exec"],
      args: [
        { uid: "1", key: "command", op: "regex", value: "^ls", values: [] },
      ],
    });
    const w = lintDraft({ defaultAction: "deny", rules: [broad, narrow] });
    expect(w[narrow.uid][0]).toMatch(
      /Never runs — rule 1 \("approve-other-shell"\)/,
    );
    // …and the correct order is silent.
    expect(
      lintDraft({ defaultAction: "deny", rules: [narrow, broad] }),
    ).toEqual({});
  });

  it("does not flag rules that merely overlap", () => {
    const a = rule({ id: "a", targets: ["shell_exec"], stepKind: "tool_call" });
    const b = rule({ id: "b", targets: ["web_search"] });
    expect(lintDraft({ defaultAction: "deny", rules: [a, b] })).toEqual({});
  });

  // A glob genuinely shadows, but proving it needs path.Match semantics we
  // deliberately don't model — staying quiet beats a false accusation.
  it("stays quiet on glob shadowing rather than guess", () => {
    const glob = rule({ id: "a", targets: ["fs_*"] });
    const exact = rule({ id: "b", targets: ["fs_write"], decision: "deny" });
    expect(lintDraft({ defaultAction: "deny", rules: [glob, exact] })).toEqual(
      {},
    );
  });
});
