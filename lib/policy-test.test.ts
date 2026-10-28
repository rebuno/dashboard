import { describe, expect, it } from "vitest";
import { type PolicyTestCaseInput, parseTestCase } from "./policy-test";

const input: PolicyTestCaseInput = {
  target: "shell.exec",
  kind: "tool_call",
  args: '{"command":"ls","options":{"recursive":false},"paths":["/tmp"]}',
};

describe("parseTestCase", () => {
  it("preserves argument values without creating an assertion by default", () => {
    expect(parseTestCase(input)).toEqual({
      target: "shell.exec",
      kind: "tool_call",
      args: {
        command: "ls",
        options: { recursive: false },
        paths: ["/tmp"],
      },
    });
  });

  it("uses an empty object when arguments are blank", () => {
    expect(parseTestCase({ ...input, args: " \n " }).args).toEqual({});
  });

  it("includes optional assertions and subject context", () => {
    expect(
      parseTestCase({
        ...input,
        name: " Safe command ",
        target: " shell.exec ",
        args: "{}",
        expect: "require_approval",
        expectRule: " review-shell ",
        subject: " alice ",
        subjectGroups:
          " developers, reviewers \n, developers\n administrators ",
      }),
    ).toEqual({
      name: "Safe command",
      target: "shell.exec",
      kind: "tool_call",
      args: {},
      expect: "require_approval",
      expect_rule: "review-shell",
      subject: "alice",
      subject_groups: ["developers", "reviewers", "administrators"],
    });
  });

  it("allows an expected rule without an expected decision", () => {
    const testCase = parseTestCase({ ...input, expectRule: "safe-shell" });
    expect(testCase.expect_rule).toBe("safe-shell");
    expect(testCase).not.toHaveProperty("expect");
  });

  it("omits empty optional fields", () => {
    const testCase = parseTestCase({
      ...input,
      name: "  ",
      expect: "",
      expectRule: " \n ",
      subject: " ",
      subjectGroups: ", \n,",
    });
    expect(testCase).toEqual(parseTestCase(input));
  });

  it("rejects an empty target", () => {
    expect(() => parseTestCase({ ...input, target: " \n " })).toThrow(
      "Enter a target to test.",
    );
  });

  it("rejects malformed JSON with a readable error", () => {
    expect(() => parseTestCase({ ...input, args: '{"command":' })).toThrow(
      "Arguments must be valid JSON.",
    );
  });

  it.each(["null", "[]", '"command"', "1", "true"])(
    "rejects non-object arguments: %s",
    (args) => {
      expect(() => parseTestCase({ ...input, args })).toThrow(
        "Arguments must be a JSON object",
      );
    },
  );
});
