import { describe, expect, it } from "vitest";
import { diffLines } from "./diff";

describe("diffLines", () => {
  it("places removals before additions and tracks both line numbers", () => {
    expect(
      diffLines(
        "rules:\n  decision: deny\nend\n",
        "rules:\n  decision: allow\nend\n",
      ),
    ).toEqual([
      {
        kind: "context",
        text: "rules:",
        oldLineNumber: 1,
        newLineNumber: 1,
        hasNewline: true,
      },
      {
        kind: "removed",
        text: "  decision: deny",
        oldLineNumber: 2,
        newLineNumber: null,
        hasNewline: true,
      },
      {
        kind: "added",
        text: "  decision: allow",
        oldLineNumber: null,
        newLineNumber: 2,
        hasNewline: true,
      },
      {
        kind: "context",
        text: "end",
        oldLineNumber: 3,
        newLineNumber: 3,
        hasNewline: true,
      },
    ]);
  });

  it("aligns unchanged lines around insertions and deletions", () => {
    const lines = diffLines("a\nremoved\nb\nc\n", "a\nb\nadded\nc\n");
    expect(lines.map(({ kind, text }) => [kind, text])).toEqual([
      ["context", "a"],
      ["removed", "removed"],
      ["context", "b"],
      ["added", "added"],
      ["context", "c"],
    ]);
    expect(lines[2]).toMatchObject({ oldLineNumber: 3, newLineNumber: 2 });
  });

  it("handles empty policies without creating phantom blank lines", () => {
    expect(diffLines("", "")).toEqual([]);
    expect(diffLines("", "deny\n")).toEqual([
      {
        kind: "added",
        text: "deny",
        oldLineNumber: null,
        newLineNumber: 1,
        hasNewline: true,
      },
    ]);
    expect(diffLines("deny", "")).toEqual([
      {
        kind: "removed",
        text: "deny",
        oldLineNumber: 1,
        newLineNumber: null,
        hasNewline: false,
      },
    ]);
  });

  it("preserves indentation and blank lines", () => {
    const lines = diffLines("rules:\n\n  deny\n", "rules:\n\n    deny\n\n");
    expect(lines.map(({ kind, text }) => [kind, text])).toEqual([
      ["context", "rules:"],
      ["context", ""],
      ["removed", "  deny"],
      ["added", "    deny"],
      ["added", ""],
    ]);
  });

  it("keeps repeated lines and reordered rules in their original order", () => {
    const before = "rules:\n  allow\n  deny\n  allow\nend\n";
    const after = "rules:\n  deny\n  allow\n  allow\nend\n";
    const lines = diffLines(before, after);
    const reconstruct = (excluded: "added" | "removed") =>
      lines
        .filter((line) => line.kind !== excluded)
        .map((line) => line.text + (line.hasNewline ? "\n" : ""))
        .join("");
    expect(reconstruct("added")).toBe(before);
    expect(reconstruct("removed")).toBe(after);
    expect(lines.filter((line) => line.kind === "removed")).toHaveLength(1);
    expect(lines.filter((line) => line.kind === "added")).toHaveLength(1);
  });

  it.each([
    ["deny", "deny\n", false, true],
    ["deny\n", "deny", true, false],
  ])(
    "detects terminal newline changes from %j to %j",
    (before, after, oldNewline, newNewline) => {
      expect(diffLines(before, after)).toEqual([
        {
          kind: "removed",
          text: "deny",
          oldLineNumber: 1,
          newLineNumber: null,
          hasNewline: oldNewline,
        },
        {
          kind: "added",
          text: "deny",
          oldLineNumber: null,
          newLineNumber: 1,
          hasNewline: newNewline,
        },
      ]);
    },
  );

  it("strips CRLF terminators from display text", () => {
    expect(
      diffLines("rules:\r\n  deny\r\n", "rules:\r\n  allow\r\n").map(
        (line) => line.text,
      ),
    ).toEqual(["rules:", "  deny", "  allow"]);
    expect(diffLines("deny\r\n", "deny\n").map((line) => line.kind)).toEqual([
      "removed",
      "added",
    ]);
  });

  it("bounds large comparisons while retaining shared prefix and suffix lines", () => {
    const before = `rules:\n${Array.from({ length: 1500 }, (_, i) => `old-${i}\n`).join("")}end\n`;
    const after = `rules:\n${Array.from({ length: 1500 }, (_, i) => `new-${i}\n`).join("")}end\n`;
    const lines = diffLines(before, after);
    expect(lines).toHaveLength(3002);
    expect(lines[0]).toMatchObject({ kind: "context", text: "rules:" });
    expect(lines.slice(1, 1501).every((line) => line.kind === "removed")).toBe(
      true,
    );
    expect(lines.slice(1501, 3001).every((line) => line.kind === "added")).toBe(
      true,
    );
    expect(lines[3001]).toMatchObject({
      kind: "context",
      text: "end",
      oldLineNumber: 1502,
      newLineNumber: 1502,
    });
  });
});
