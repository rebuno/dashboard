"use client";

import { type DependencyList, useEffect, useRef } from "react";

export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  deps: DependencyList = [],
) {
  const savedFn = useRef(fn);

  // An effect rather than a render-body write, so this is safe under concurrent
  // rendering; hooks run in declaration order, so the interval effect below
  // always sees the current fn.
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
        // Callers own their error state; this only stops an unhandled rejection.
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
    // fn is excluded on purpose: the ref always holds the latest, and restarting
    // the interval on every identity change would defeat it. `deps` opts in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
