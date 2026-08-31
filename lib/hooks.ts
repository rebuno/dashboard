"use client";

import { type DependencyList, useEffect, useRef } from "react";

export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  deps: DependencyList = [],
) {
  const savedFn = useRef(fn);

  // Keep the ref current via an effect (not a render-body write) so this
  // hook is safe under concurrent rendering. Runs after every render, before
  // the interval effect below within the same commit (hooks run in
  // declaration order), so `savedFn.current` is always up to date by the
  // time the interval effect's own setup (including its immediate `tick()`)
  // runs — whether that's on mount or after `deps` changes.
  useEffect(() => {
    savedFn.current = fn;
  });

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    async function tick() {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        await savedFn.current();
      } catch {
        // Callers own their own error state (every fn here already
        // try/catches internally); this is just a safety net against an
        // unhandled rejection reaching the console.
      } finally {
        inFlight = false;
      }
    }
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // fn is intentionally excluded: we always call the latest via the ref,
    // and re-running this effect on every fn identity change would defeat
    // the point of a stable interval. `deps` lets callers opt into a restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
