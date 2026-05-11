import { describe, it, expect } from "vitest";
import { formatTimeForRange, sumDeltas } from "./chart-utils";

describe("formatTimeForRange", () => {
  it("returns HH:MM formatter for spans under 6 hours", () => {
    const now = Math.floor(Date.now() / 1000);
    const data = [
      { time: now - 3600 },
      { time: now },
    ];
    const fmt = formatTimeForRange(data);
    const result = fmt(now);
    // Should be HH:MM format
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns date+time formatter for spans between 6h and 2d", () => {
    const now = Math.floor(Date.now() / 1000);
    const data = [
      { time: now - 12 * 3600 },
      { time: now },
    ];
    const fmt = formatTimeForRange(data);
    const result = fmt(now);
    // Should contain month abbreviation and time
    expect(result).toMatch(/[A-Z][a-z]{2}\s+\d/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("returns date-only formatter for spans over 2 days", () => {
    const now = Math.floor(Date.now() / 1000);
    const data = [
      { time: now - 7 * 24 * 3600 },
      { time: now },
    ];
    const fmt = formatTimeForRange(data);
    const result = fmt(now);
    // Should contain month abbreviation and day, no time
    expect(result).toMatch(/[A-Z][a-z]{2}\s+\d/);
    expect(result).not.toMatch(/\d{2}:\d{2}/);
  });

  it("returns HH:MM formatter for empty or single-point data", () => {
    const fmt = formatTimeForRange([]);
    const now = Math.floor(Date.now() / 1000);
    const result = fmt(now);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("sumDeltas", () => {
  it("sums values across all points per key", () => {
    const deltas = [
      { time: 1, completed: 5, failed: 1 },
      { time: 2, completed: 3, failed: 2 },
      { time: 3, completed: 2, failed: 0 },
    ];
    const result = sumDeltas(deltas);
    expect(result).toEqual({ completed: 10, failed: 3 });
  });

  it("returns empty object for empty input", () => {
    expect(sumDeltas([])).toEqual({});
  });

  it("handles single point", () => {
    const deltas = [{ time: 1, accepted: 7 }];
    expect(sumDeltas(deltas)).toEqual({ accepted: 7 });
  });
});
