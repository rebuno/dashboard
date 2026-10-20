import { afterEach, describe, expect, it, vi } from "vitest";
import { type PolicyTestReport, testPolicy } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("testPolicy", () => {
  it("tests a draft through the proxy and preserves failed assertions", async () => {
    const report: PolicyTestReport = {
      results: [
        {
          target: "shell.exec",
          expect: "allow",
          decision: "deny",
          rule_id: "block-shell",
          reason: "Shell access is blocked",
          pass: false,
          failure: "deny, want allow",
        },
      ],
      failed: 1,
      unexercised_rules: ["read-files"],
    };
    const fetch = vi.fn().mockResolvedValue(Response.json(report));
    vi.stubGlobal("fetch", fetch);
    const body = {
      bundle: "default_action: deny\nrules: []\n",
      cases: [{ target: "shell.exec", expect: "allow" as const }],
    };
    const controller = new AbortController();

    expect(await testPolicy("agent/a", body, controller.signal)).toEqual(
      report,
    );
    expect(fetch).toHaveBeenCalledWith("/api/v0/policies/agent%2Fa/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  });

  it("sends execution replay without manual cases", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ results: [], failed: 0 }));
    vi.stubGlobal("fetch", fetch);
    const body = {
      bundle: "default_action: deny",
      execution_id: "execution-1",
    };

    await testPolicy("agent-a", body);

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);
  });

  it("surfaces the kernel's validation error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: "invalid policy bundle" }, { status: 400 }),
        ),
    );

    await expect(
      testPolicy("agent-a", { bundle: "invalid", cases: [] }),
    ).rejects.toThrow("invalid policy bundle");
  });
});
