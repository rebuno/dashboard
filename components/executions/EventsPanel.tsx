"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Event, getEvents } from "@/lib/api";
import { EXECUTION_DETAIL_POLL_INTERVAL } from "@/lib/constants";
import { usePolling } from "@/lib/hooks";

const eventCache = new Map<string, { events: Event[]; lastSeq: number }>();

export default function EventsPanel({ executionId }: { executionId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastSeq = useRef(0);

  useEffect(() => {
    const cached = eventCache.get(executionId);
    setEvents(cached?.events ?? []);
    lastSeq.current = cached?.lastSeq ?? 0;
    setLoading(!cached);
    setError(null);
  }, [executionId]);

  const load = useCallback(async () => {
    try {
      const batch = await getEvents(executionId, lastSeq.current);
      if (batch.length > 0) {
        lastSeq.current = Math.max(
          lastSeq.current,
          ...batch.map((e) => e.event_seq),
        );
        setEvents((prev) => {
          const next = [...prev, ...batch];
          eventCache.set(executionId, {
            events: next,
            lastSeq: lastSeq.current,
          });
          return next;
        });
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  usePolling(load, EXECUTION_DETAIL_POLL_INTERVAL, [executionId]);

  if (loading)
    return <div className="p-5 text-sm text-ink-muted">Loading events…</div>;
  if (error)
    return (
      <div className="m-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {error}
      </div>
    );
  if (events.length === 0)
    return (
      <div className="m-5 empty-state">No events have been recorded yet.</div>
    );

  return (
    <div className="divide-y divide-line font-mono text-xs">
      {events.map((evt) => (
        <div key={evt.event_seq} className="px-5 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-right text-ink-faint tabular-nums">
              {evt.event_seq}
            </span>
            <span className="hidden shrink-0 text-ink-muted tabular-nums sm:inline">
              {new Date(evt.occurred_at).toLocaleTimeString()}
            </span>
            <span className="font-medium text-ink-soft">{evt.type}</span>
          </div>
          {evt.payload && Object.keys(evt.payload).length > 0 && (
            <pre className="mt-2 ml-11 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md border border-line bg-canvas p-3 text-[11px] leading-relaxed text-ink-muted sm:ml-[8.25rem]">
              {JSON.stringify(evt.payload, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
