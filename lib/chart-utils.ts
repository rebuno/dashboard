interface TimeSeriesLike {
  time: number;
  [key: string]: number;
}

export function formatTimeForRange(
  data: { time: number }[]
): (t: number) => string {
  if (data.length < 2) {
    return (t: number) =>
      new Date(t * 1000).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
  }

  const spanSeconds = data[data.length - 1].time - data[0].time;

  if (spanSeconds > 2 * 24 * 3600) {
    return (t: number) => {
      const d = new Date(t * 1000);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };
  }

  if (spanSeconds > 6 * 3600) {
    return (t: number) => {
      const d = new Date(t * 1000);
      const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const time = d.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${date} ${time}`;
    };
  }

  return (t: number) =>
    new Date(t * 1000).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
}

export function sumDeltas(deltas: TimeSeriesLike[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const point of deltas) {
    for (const [key, val] of Object.entries(point)) {
      if (key === "time") continue;
      result[key] = (result[key] || 0) + Math.max(0, val as number);
    }
  }
  return result;
}
