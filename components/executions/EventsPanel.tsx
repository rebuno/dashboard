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
    return (
      <div className="p-4 text-sm text-gray-400 dark:text-gray-400">
        Loading events…
      </div>
    );
  if (error)
    return (
      <div className="p-4 text-sm text-red-600 dark:text-red-400">{error}</div>
    );
  if (events.length === 0)
    return (
      <div className="p-4 text-sm text-gray-400 dark:text-gray-400">
        No events yet
      </div>
    );

  return (
    <div className="divide-y divide-gray-100 font-mono text-xs dark:divide-gray-800">
      {events.map((evt) => (
        <div key={evt.event_seq} className="px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 tabular-nums w-10 text-right dark:text-gray-400">
              {evt.event_seq}
            </span>
            <span className="text-gray-400 dark:text-gray-400">
              {new Date(evt.occurred_at).toLocaleTimeString()}
            </span>
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {evt.type}
            </span>
          </div>
          {evt.payload && Object.keys(evt.payload).length > 0 && (
            <pre className="mt-1 ml-[3.75rem] text-gray-500 whitespace-pre-wrap break-all dark:text-gray-400">
              {JSON.stringify(evt.payload, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
