"use client";

import {
  type DependencyList,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type Event, getEvents } from "./api";
import { EVENT_PAGE_SIZE, EXECUTION_DETAIL_POLL_INTERVAL } from "./constants";

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

const eventCache = new Map<string, Event[]>();
const NO_EVENTS: Event[] = [];

export function useExecutionEvents(executionId: string) {
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    try {
      let next = eventCache.get(executionId) ?? NO_EVENTS;
      for (;;) {
        const batch = await getEvents(executionId, next.at(-1)?.event_seq ?? 0);
        if (batch.length > 0) next = [...next, ...batch];
        if (batch.length < EVENT_PAGE_SIZE) break;
      }
      // A log only grows, so a shorter result is a stale response.
      if (next.length > (eventCache.get(executionId)?.length ?? -1))
        eventCache.set(executionId, next);
      setErrors((prev) => ({ ...prev, [executionId]: null }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load events";
      setErrors((prev) => ({ ...prev, [executionId]: message }));
    }
  }, [executionId]);

  usePolling(load, EXECUTION_DETAIL_POLL_INTERVAL, [executionId]);

  return {
    events: eventCache.get(executionId) ?? NO_EVENTS,
    error: errors[executionId] ?? null,
    loading: !(executionId in errors) && !eventCache.has(executionId),
  };
}
