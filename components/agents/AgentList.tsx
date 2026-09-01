"use client";

import { useState } from "react";
import { type Agent, deleteAgent } from "@/lib/api";
import PolicyEditor from "./PolicyEditor";

export default function AgentList({
  agents,
  onChanged,
}: {
  agents: Agent[];
  onChanged: () => void;
}) {
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function setBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(id: string) {
    setBusy(id, true);
    try {
      await deleteAgent(id);
      onChanged();
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : "Failed to delete",
      }));
    } finally {
      setBusy(id, false);
    }
  }

  if (agents.length === 0) {
    return <p className="text-sm text-gray-400">No agents registered</p>;
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => {
        const expanded = expandedIds.has(agent.id);
        const detailsId = `agent-${encodeURIComponent(agent.id)}-details`;

        return (
          <div
            key={agent.id}
            className="border border-gray-200 rounded-md bg-white overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleExpanded(agent.id)}
              aria-expanded={expanded}
              aria-controls={detailsId}
              className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{agent.id}</div>
                <div className="text-xs text-gray-500 truncate">
                  {agent.webhook_url}
                </div>
                <div className="text-xs text-gray-400">
                  registered {new Date(agent.registered_at).toLocaleString()}
                </div>
              </div>
              <span className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                {expanded ? "Hide details" : "Show details"}
                <span aria-hidden>{expanded ? "▾" : "▸"}</span>
              </span>
            </button>

            <div
              id={detailsId}
              hidden={!expanded}
              className="border-t border-gray-200 p-4 space-y-3"
            >
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleDelete(agent.id)}
                  disabled={busyIds.has(agent.id)}
                  className="border border-red-300 text-red-600 rounded px-3 py-1 text-xs hover:bg-red-50 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
              {errors[agent.id] && (
                <p className="text-xs text-red-600">{errors[agent.id]}</p>
              )}
              {/* Kept mounted while collapsed so an in-progress edit survives. */}
              <PolicyEditor
                key={agent.id}
                agentId={agent.id}
                bundle={agent.policy_bundle ?? ""}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
