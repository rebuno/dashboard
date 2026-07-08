"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEvents, type Event } from "@/lib/api";
import { usePolling } from "@/lib/hooks";
import { EXECUTION_DETAIL_POLL_INTERVAL } from "@/lib/constants";

export default function EventsPanel({ executionId }: { executionId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastSeq = useRef(0);

  useEffect(() => {
    setEvents([]);
    lastSeq.current = 0;
    setLoading(true);
    setError(null);
  }, [executionId]);

  const load = useCallback(async () => {
    try {
      const batch = await getEvents(executionId, lastSeq.current);
      if (batch.length > 0) {
        setEvents((prev) => [...prev, ...batch]);
        lastSeq.current = Math.max(lastSeq.current, ...batch.map((e) => e.event_seq));
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  usePolling(load, EXECUTION_DETAIL_POLL_INTERVAL, [executionId]);

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading events…</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (events.length === 0) return <div className="p-4 text-sm text-gray-400">No events yet</div>;

  return (
    <div className="divide-y divide-gray-100 font-mono text-xs">
      {events.map((evt) => (
        <div key={evt.event_seq} className="px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 tabular-nums w-10 text-right">{evt.event_seq}</span>
            <span className="text-gray-400">{new Date(evt.occurred_at).toLocaleTimeString()}</span>
            <span className="font-medium text-gray-700">{evt.type}</span>
          </div>
          {evt.payload && Object.keys(evt.payload).length > 0 && (
            <pre className="mt-1 ml-[3.75rem] text-gray-500 whitespace-pre-wrap break-all">
              {JSON.stringify(evt.payload, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
