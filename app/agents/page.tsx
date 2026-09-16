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
    <div className="page-shell max-w-5xl">
      <header className="page-header">
        <div>
          <h1 className="page-title">Agents</h1>
          <p className="page-description">
            Register webhook workers and manage the policy each one runs under.
          </p>
        </div>
      </header>
      <AgentForm onRegistered={load} />
      {loading && (
        <p className="mt-5 text-sm text-ink-muted">Loading agents…</p>
      )}
      {error && (
        <p className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {!loading && !error && (
        <div className="mt-5">
          <AgentList agents={agents} onChanged={load} />
        </div>
      )}
    </div>
  );
}
