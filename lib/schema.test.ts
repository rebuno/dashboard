import { describe, expect, it } from "vitest";
import { inputSkeleton } from "./schema";

describe("inputSkeleton", () => {
  it("fills required properties with placeholders for their types", () => {
    expect(
      inputSkeleton({
        type: "object",
        required: ["topic", "depth", "tags", "strict", "mode"],
        properties: {
          topic: { type: "string" },
          depth: { type: "integer" },
          tags: { type: "array", items: { type: "string" } },
          strict: { type: "boolean" },
          mode: { enum: ["fast", "deep"] },
          note: { type: "string" },
        },
      }),
    ).toEqual({ topic: "", depth: 0, tags: [], strict: false, mode: "fast" });
  });

  it("follows local references into nested models", () => {
    expect(
      inputSkeleton({
        $defs: {
          Source: {
            type: "object",
            required: ["url"],
            properties: { url: { type: "string" } },
          },
        },
        type: "object",
        required: ["source"],
        properties: { source: { $ref: "#/$defs/Source" } },
      }),
    ).toEqual({ source: { url: "" } });
  });

  it("stops at recursive references", () => {
    const node = {
      type: "object",
      required: ["child"],
      properties: { child: { $ref: "#" } },
    };
    let value = inputSkeleton(node) as { child: unknown } | null;
    let depth = 0;
    while (value !== null) {
      value = value.child as { child: unknown } | null;
      depth++;
    }
    expect(depth).toBeGreaterThan(1);
  });
});
