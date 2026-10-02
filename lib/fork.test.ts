import { describe, expect, it } from "vitest";
import type { ForkPoints } from "./api";
import { selectRestoration } from "./fork";

const points: ForkPoints = {
  latest_seq: 30,
  resources: { workspace: 5, database: 20 },
  checkpoints: [
    {
      key: "workspace",
      generation: 0,
      checkpoint_ref: "snap-0",
      covered_seq: 6,
      invalidated_seq: 10,
    },
    {
      key: "workspace",
      generation: 1,
      checkpoint_ref: "snap-1",
      covered_seq: 14,
    },
  ],
};

describe("selectRestoration", () => {
  it("omits resources registered after the fork point", () => {
    expect(selectRestoration(points, 4)).toEqual({});
  });

  it("restores the initial state before the first checkpoint", () => {
    expect(selectRestoration(points, 5)).toEqual({
      workspace: { covered: false },
    });
  });

  it("selects the checkpoint covering the fork point", () => {
    expect(selectRestoration(points, 9)).toEqual({
      workspace: {
        checkpoint_ref: "snap-0",
        checkpoint_seq: 6,
        covered: true,
      },
    });
  });

  it("falls back to the newest earlier checkpoint when uncovered", () => {
    expect(selectRestoration(points, 12)).toEqual({
      workspace: {
        checkpoint_ref: "snap-0",
        checkpoint_seq: 6,
        covered: false,
      },
    });
  });

  it("selects per resource", () => {
    expect(selectRestoration(points, 25)).toEqual({
      workspace: {
        checkpoint_ref: "snap-1",
        checkpoint_seq: 14,
        covered: true,
      },
      database: { covered: false },
    });
  });
});
