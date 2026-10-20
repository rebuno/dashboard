import type { PolicyTestCase, PolicyTestDecision, Step } from "./api";

export interface PolicyTestCaseInput {
  name?: string;
  target: string;
  kind: Step["kind"];
  args: string;
  expect?: PolicyTestDecision | "";
  expectRule?: string;
  subject?: string;
  subjectGroups?: string;
}

export function parseTestCase(input: PolicyTestCaseInput): PolicyTestCase {
  const target = input.target.trim();
  if (!target) throw new Error("Enter a target to test.");

  let args: unknown;
  try {
    args = JSON.parse(input.args.trim() || "{}");
  } catch {
    throw new Error("Arguments must be valid JSON.");
  }
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    throw new Error(
      'Arguments must be a JSON object, such as {"path": "/tmp"}.',
    );
  }

  const testCase: PolicyTestCase = {
    target,
    kind: input.kind,
    args: args as Record<string, unknown>,
  };
  if (input.name?.trim()) testCase.name = input.name.trim();
  if (input.expect) testCase.expect = input.expect;
  if (input.expectRule?.trim()) testCase.expect_rule = input.expectRule.trim();
  if (input.subject?.trim()) testCase.subject = input.subject.trim();
  const groups = input.subjectGroups
    ?.split(/[,\n]/)
    .map((group) => group.trim())
    .filter(Boolean);
  if (groups?.length) testCase.subject_groups = [...new Set(groups)];
  return testCase;
}
