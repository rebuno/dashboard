"use client";

import { useCallback, useState } from "react";
import AgentForm from "@/components/agents/AgentForm";
import AgentList from "@/components/agents/AgentList";
import { type Agent, listAgents } from "@/lib/api";
import { AGENTS_POLL_INTERVAL } from "@/lib/constants";
import { usePolling } from "@/lib/hooks";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setAgents(await listAgents());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(load, AGENTS_POLL_INTERVAL);

  return (
    <div className="p-6 max-w-3xl mx-auto w-full space-y-4">
      <h1 className="text-lg font-semibold">Agents</h1>
      <AgentForm onRegistered={load} />
      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && <AgentList agents={agents} onChanged={load} />}
    </div>
  );
}
