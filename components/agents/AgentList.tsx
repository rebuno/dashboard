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
    return (
      <div className="empty-state">
        <div>
          <p className="font-medium text-ink-soft">No agents registered</p>
          <p className="mt-1 text-xs">
            Register a worker above to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => {
        const expanded = expandedIds.has(agent.id);
        const detailsId = `agent-${encodeURIComponent(agent.id)}-details`;

        return (
          <div key={agent.id} className="surface-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggleExpanded(agent.id)}
              aria-expanded={expanded}
              aria-controls={detailsId}
              className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-surface-muted"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-canvas text-ink-muted">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-4 w-4"
                  >
                    <circle cx="12" cy="8" r="3.25" />
                    <path d="M5.5 20c.45-3.55 2.55-5.5 6.5-5.5s6.05 1.95 6.5 5.5" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{agent.id}</div>
                  <div className="truncate font-mono text-[11px] text-ink-muted">
                    {agent.webhook_url}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-faint">
                    Registered {new Date(agent.registered_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-muted">
                <span className="hidden sm:inline">
                  {expanded ? "Hide" : "Manage"}
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
                >
                  <path d="m4.25 2.5 3.5 3.5-3.5 3.5" />
                </svg>
              </span>
            </button>

            <div
              id={detailsId}
              hidden={!expanded}
              className="space-y-4 border-t border-line bg-canvas/45 p-5"
            >
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleDelete(agent.id)}
                  disabled={busyIds.has(agent.id)}
                  className="button-danger"
                >
                  Delete
                </button>
              </div>
              {errors[agent.id] && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors[agent.id]}
                </p>
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
