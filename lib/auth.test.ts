import { describe, expect, it } from "vitest";
import { chunk, safeReturnTo, seal, unseal } from "./auth";

const SECRET = "s".repeat(32);

describe("session sealing", () => {
  it("round-trips and rejects tampering or another secret", () => {
    const sealed = seal({ token: "t", exp: 1 }, SECRET);
    expect(unseal(sealed, SECRET)).toEqual({ token: "t", exp: 1 });
    expect(unseal(sealed, "x".repeat(32))).toBeNull();
    const flipped = `${sealed.slice(0, -2)}${sealed.at(-2) === "A" ? "B" : "A"}${sealed.at(-1)}`;
    expect(unseal(flipped, SECRET)).toBeNull();
  });

  it("splits a sealed session into cookie-sized chunks that rejoin", () => {
    const sealed = seal({ token: "x".repeat(9000) }, SECRET);
    const parts = chunk(sealed);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.every((p) => p.length <= 3800)).toBe(true);
    expect(unseal(parts.join(""), SECRET)).toEqual({ token: "x".repeat(9000) });
  });
});

describe("safeReturnTo", () => {
  it("keeps local paths and refuses other origins", () => {
    expect(safeReturnTo("/executions/e1?tree=1")).toBe("/executions/e1?tree=1");
    for (const bad of [
      null,
      "",
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
    ])
      expect(safeReturnTo(bad)).toBe("/");
  });
});
