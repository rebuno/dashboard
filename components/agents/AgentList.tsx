"use client";

import { useState } from "react";
import { deleteAgent, type Agent } from "@/lib/api";
import PolicyEditor from "./PolicyEditor";

export default function AgentList({ agents, onChanged }: { agents: Agent[]; onChanged: () => void }) {
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleDelete(id: string) {
    setBusy(id, true);
    try {
      await deleteAgent(id);
      onChanged();
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Failed to delete" }));
    } finally {
      setBusy(id, false);
    }
  }

  if (agents.length === 0) {
    return <p className="text-sm text-gray-400">No agents registered</p>;
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <div key={agent.ID} className="border border-gray-200 rounded-md p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{agent.ID}</div>
              <div className="text-xs text-gray-500">{agent.WebhookURL}</div>
              <div className="text-xs text-gray-400">registered {new Date(agent.RegisteredAt).toLocaleString()}</div>
            </div>
            <button
              onClick={() => handleDelete(agent.ID)}
              disabled={busyIds.has(agent.ID)}
              className="border border-red-300 text-red-600 rounded px-3 py-1 text-xs hover:bg-red-50 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
          {errors[agent.ID] && <p className="text-xs text-red-600">{errors[agent.ID]}</p>}
          {/* Keyed by agent so an edit in progress survives the list poll. */}
          <PolicyEditor key={agent.ID} agentId={agent.ID} bundle={agent.PolicyBundle ?? ""} />
        </div>
      ))}
    </div>
  );
}
