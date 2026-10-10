import { describe, expect, it } from "vitest";
import type { Execution } from "./api";
import { executionLabel } from "./execution-tree";

const parent = "01a123ac-e64d-7d37-8140-61bd0d1d0034";
const execution = (fields: Partial<Execution>) =>
  ({ id: "child", agent_id: "code", ...fields }) as Execution;

describe("executionLabel", () => {
  it("names a subagent by the part of its session after the parent's ID", () => {
    expect(
      executionLabel(
        execution({
          session: `subagent:${parent}:duration-review`,
          spawned_by: { execution_id: parent, step_id: "s" },
        }),
      ),
    ).toBe("duration-review");
  });

  it("falls back to the agent when the session does not name the subagent", () => {
    expect(
      executionLabel(
        execution({
          session: `${parent}`,
          spawned_by: { execution_id: parent, step_id: "s" },
        }),
      ),
    ).toBe("code");
    expect(
      executionLabel(
        execution({
          session: "research",
          spawned_by: { execution_id: parent, step_id: "s" },
        }),
      ),
    ).toBe("code");
    expect(executionLabel(execution({ session: `x:${parent}:y` }))).toBe(
      "code",
    );
  });
});
